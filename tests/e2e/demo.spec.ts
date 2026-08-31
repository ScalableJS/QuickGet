import path from "node:path";
import { fileURLToPath } from "node:url";

import { type BrowserContext, chromium, expect, type Page, test, type Worker } from "@playwright/test";

import { closePopupWindow, openActionPopup, openPopupWindow, waitForActionPopupTarget } from "./support/actionPopup.js";
import { startDemoPageHost } from "./support/demoPageHost.js";
import { createDemoProfile, demoWindowArgs, placeDemoWindow } from "./support/demoProfile.js";
import { startMockNas } from "./support/mockNas.js";
import { finishMaster, READ, SceneRecorder } from "./support/sceneRecorder.js";
import { SystemCursor } from "./support/systemCursor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../dist");
const outputDir = path.resolve(__dirname, "../../demo-output");

/**
 * The promo recording — and a real end-to-end test of the product.
 *
 * One run produces both a pass/fail result and the master video. Every beat waits on a *fact*,
 * so the causal chain is asserted end to end: a real click → interception → a real HTTP request
 * to the NAS → its response → real extension state → the real toolbar badge → the real action
 * popup. If the product breaks, the run goes red and yields no usable master.
 *
 * Only runs with `E2E_RECORD_DEMO=true` — it drives the physical mouse and captures the screen,
 * neither of which belongs in an ordinary suite.
 *
 * Full method, decisions and their evidence: `agent-os/product/demo-video-kanban.md`.
 */
test.describe("promo demo", () => {
  test.skip(process.env.E2E_RECORD_DEMO !== "true", "set E2E_RECORD_DEMO=true to record");
  test.setTimeout(300_000);

  test("intercepts a torrent and shows it downloading on the NAS", async () => {
    expect(await SystemCursor.isAvailable(), "cliclick is required to drive the on-camera pointer").toBe(true);

    // A single downloading task, advancing on every poll, so the closing shot actually moves.
    // This scripts the *backend*; the popup still renders it with production code.
    const mockNas = await startMockNas({
      initialTasks: [],
      progressFixture: { stepPercent: 12 },
    });
    const host = await startDemoPageHost({ bodyDelayMs: 400 });
    const userDataDir = await createDemoProfile();

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: false,
      // Without this Playwright's viewport overrides the window size and the frame is wrong.
      viewport: null,
      acceptDownloads: true,
      args: demoWindowArgs(extensionPath),
    });

    const recorder = new SceneRecorder({
      outputPath: path.join(outputDir, "capture.mov"),
    });

    try {
      const worker = await resolveWorker(context);
      const extensionId = worker.url().split("/")[2];

      const page = context.pages()[0] ?? (await context.newPage());
      const cdp = await context.newCDPSession(page);
      const bounds = await placeDemoWindow(cdp);

      // The crop is built from the granted bounds, never the requested ones.
      expect(bounds.width, "window must be exactly 16:9 at 1080p").toBe(1920);
      expect(bounds.height).toBe(1080);

      await page.goto(host.url);
      await expect(page.locator("#download-torrent")).toBeVisible();

      const cursor = await SystemCursor.measure(page, bounds);
      await cursor.park();

      // Only the theme is seeded — everything else is typed on camera.
      //
      // `theme` is a real product setting (light | dark | auto, see `applyTheme.ts`), pinned here
      // so the frame does not depend on the recording machine's OS setting. Dark, matched by the
      // fixture page: left on "auto" the popup followed dark macOS while the page was pinned light,
      // and the frame carried two clashing themes.
      await worker.evaluate(async () => {
        await chrome.storage.local.set({ theme: "dark" });
      });

      const popupWindowId = await openPopupWindow(worker, extensionId, bounds);
      const popup = await context.waitForEvent("page", {
        predicate: (candidate) => candidate.url().includes(`${extensionId}/src/popup/index.html`),
        timeout: 15_000,
      });
      // The popup is its own window with its own screen origin — a cursor measured against the
      // main window would click somewhere else entirely.
      const popupCursor = await SystemCursor.forWindow(popup);
      await openSettings(popup, popupCursor);

      recorder.setCrop(`${bounds.width}:${bounds.height}:${bounds.left}:${bounds.top}`);
      await recorder.start();
      await recorder.hold(700); // pre-roll on a settled frame

      // ---- 1. An empty form, filled in on camera ---------------------------------------
      //
      // Typed with the real keyboard, not `fill()`: the demo claims a person can set this up, so
      // the video shows the characters arriving. `delay` is what makes it legible — an instant
      // substitution reads as a cut, not as typing. The short hold between fields is the beat a
      // viewer needs to follow the focus moving, and it also lets the form settle before the
      // system pointer aims at the next control.
      recorder.mark("Point QuickGet at your QNAP — address, username, password");
      await popupCursor.click(popup.locator("#serverUrl"));
      await popup.locator("#serverUrl").pressSequentially(`http://127.0.0.1:${mockNas.port}`, { delay: 45 });
      await recorder.hold(READ.glance);

      await popupCursor.click(popup.locator("#NASlogin"));
      await popup.locator("#NASlogin").pressSequentially("admin", { delay: 60 });
      await recorder.hold(READ.glance);

      await popupCursor.click(popup.locator("#NASpassword"));
      await popup.locator("#NASpassword").pressSequentially("demo-password", { delay: 45 });
      await recorder.hold(READ.normal);

      // ---- 2. Folders are already right, and the .torrent stays off this machine ----------
      //
      // Temp and Target come pre-filled from `DEFAULTS` (`Download`), so nothing is typed here —
      // the shot is about what the user does *not* have to do. Only the interception refinement
      // is toggled.
      recorder.mark("Folders come ready to use — and the .torrent never touches this computer");
      await expect(popup.locator("#NAStempdir")).toHaveValue("Download");
      await popupCursor.click(popup.locator("#suppressLocalTorrentFile"));
      await expect(popup.locator("#suppressLocalTorrentFile")).toBeChecked();
      await recorder.hold(READ.normal);

      // ---- 3. Save & test — one action, and a real round-trip to the NAS -------------------
      //
      // The product deliberately couples saving to testing: settings that cannot reach the NAS
      // should say so immediately. So this single click is also the proof the connection works.
      recorder.mark("Save — QuickGet checks the connection straight away");
      await popupCursor.click(popup.getByRole("button", { name: /Save & test/i }));
      await expect(popup.getByText(/admin@127\.0\.0\.1/)).toBeVisible({ timeout: 15_000 });
      await recorder.hold(READ.page);

      // Settings shown; close the popup so the next beats show the page and the real toolbar.
      await closePopupWindow(worker, popupWindowId);

      // ---- 4. An ordinary download page --------------------------------------------------
      recorder.mark("Open a page with an ordinary .torrent link");
      await page.goto(host.url);
      await expect(page.locator("#download-torrent")).toBeVisible();
      await recorder.hold(READ.glance);

      // ---- 5. Interception, proven by the real toolbar badge -----------------------------
      await cursor.click(page.locator("#download-torrent"));

      await expect.poll(() => host.torrentRequestCount(), { timeout: 15_000 }).toBeGreaterThan(0);
      await expect.poll(() => worker.evaluate(() => chrome.action.getBadgeText({})), { timeout: 20_000 }).toBe("1");

      recorder.mark(
        "QuickGet intercepts the torrent and sends it to the NAS — the toolbar icon and badge show the active task",
      );
      await cursor.park();
      await recorder.hold(READ.study);

      // ---- 6. The real popup, with progress actually moving -------------------------------
      await openActionPopup(worker);
      await waitForActionPopupTarget(context, page, extensionId);

      const firstProgress = await nasProgress(mockNas.port);
      await expect.poll(() => nasProgress(mockNas.port), { timeout: 20_000 }).toBeGreaterThan(firstProgress);

      recorder.mark("The download is running — progress is visible right inside QuickGet");
      await recorder.hold(READ.study + 2_500); // hold on the motion, not a frozen number
      await recorder.hold(700); // post-roll

      recorder.assertRealTime();
    } finally {
      await recorder.stop();
      await context.close();
      await host.close();
      await mockNas.close();
    }

    const srtPath = path.join(outputDir, "demo.en.srt");
    await recorder.writeSrt(srtPath);
    await finishMaster({
      capturePath: path.join(outputDir, "capture.mov"),
      outputPath: path.join(outputDir, "promo.mp4"),
      subtitles: srtPath,
    });
  });
});

async function resolveWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker", { timeout: 15_000 }));
}

/**
 * Reveals the Settings panel in an already-open popup window.
 *
 * The settings beats cannot use the action popup: it closes the moment focus moves, and this
 * beat is nothing but typing. A popup-type window is the closest honest stand-in — same size,
 * same UI, no address bar. The real action popup is used later, where it is the point of the shot.
 */
async function openSettings(popup: Page, cursor: SystemCursor): Promise<void> {
  await expect(popup.locator("#toolbar-settings")).toBeVisible({ timeout: 15_000 });
  await cursor.click(popup.locator("#toolbar-settings"));
  await expect(popup.locator("#settings-panel")).toBeVisible({ timeout: 10_000 });
}



/** Reads the task's progress straight from the NAS, not by scraping the popup — see DEMO-5. */
async function nasProgress(port: number): Promise<number> {
  const response = await fetch(`http://127.0.0.1:${port}/downloadstation/V4/Task/Query`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "from=0&limit=50",
  });
  const payload = (await response.json()) as { data?: Array<{ progress?: number }> };
  return payload.data?.[0]?.progress ?? 0;
}
