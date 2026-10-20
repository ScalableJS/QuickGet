import path from "node:path";
import { fileURLToPath } from "node:url";

import { type BrowserContext, chromium, expect, type Page, test, type Worker } from "@playwright/test";
import { closePopupWindow, openActionPopup, openPopupWindow, waitForActionPopupTarget } from "./support/actionPopup.js";
import { prodBuildPath } from "./support/builds.js";
import { narrationText, prepareNarration } from "./support/demoNarration.js";
import { startDemoPageHost } from "./support/demoPageHost.js";
import { createDemoProfile, demoWindowArgs, placeDemoWindow } from "./support/demoProfile.js";
import { startMockNas } from "./support/mockNas.js";
import { finishMaster, READ, SceneRecorder } from "./support/sceneRecorder.js";
import { SystemCursor } from "./support/systemCursor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

  test("configures routing and sends a torrent and an ordinary file to the NAS", async () => {
    expect(await SystemCursor.isAvailable(), "cliclick is required to drive the on-camera pointer").toBe(true);

    const narration = await prepareNarration(path.join(outputDir, "voice"));

    // Downloading tasks advance on each poll, so the closing shot actually moves.
    // This scripts the *backend*; the popup still renders it with production code.
    const mockNas = await startMockNas({
      initialTasks: [],
      progressFixture: { stepPercent: 3 },
      extraRootFolders: ["dev"],
    });
    const host = await startDemoPageHost({ bodyDelayMs: 400 });
    const userDataDir = await createDemoProfile();

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: false,
      // Without this Playwright's viewport overrides the window size and the frame is wrong.
      viewport: null,
      acceptDownloads: true,
      args: demoWindowArgs(prodBuildPath),
    });

    const recorder = new SceneRecorder({
      outputPath: path.join(outputDir, "capture.mov"),
      captureCursor: true,
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
      // Clear the previous list-refresh message through the product's own dismissal action.
      // Connection fields remain empty; the live configuration warning stays on screen.
      const dismiss = popup.getByRole("button", { name: "Dismiss message" });
      if (await dismiss.isVisible()) await popupCursor.click(dismiss);
      await cursor.park();

      recorder.setCrop(`${bounds.width}:${bounds.height}:${bounds.left}:${bounds.top}`);
      await recorder.start();
      await recorder.hold(700); // pre-roll on a settled frame

      // Introduce the support walkthrough before the first action.
      recorder.mark(narrationText[0]);
      await narration.finishScene(recorder);

      recorder.mark(narrationText[1]);
      await popupCursor.click(popup.locator("#serverUrl"));
      await popup.locator("#serverUrl").pressSequentially(`http://127.0.0.1:${mockNas.port}`, { delay: 45 });
      await popupCursor.click(popup.locator("#NASlogin"));
      await popup.locator("#NASlogin").pressSequentially("admin", { delay: 60 });
      await popupCursor.click(popup.locator("#NASpassword"));
      await popup.locator("#NASpassword").pressSequentially("demo-password", { delay: 45 });
      await popupCursor.click(popup.getByRole("button", { name: /Save & test/i }));
      await expect(popup.getByText(/admin@127\.0\.0\.1/)).toBeVisible({ timeout: 15_000 });
      await expect(popup.locator(".connection-health")).toHaveText("Ready");
      await recorder.hold(READ.page);
      await narration.finishScene(recorder);

      recorder.mark(narrationText[2]);
      await expect(popup.locator("#NAStempdir")).toHaveValue("Download");
      await expect(popup.locator("#NASdir")).toHaveValue("Download");
      await popup.locator("#NASdir").evaluate((element) => element.scrollIntoView({ block: "center" }));
      await expect(popup.locator("#interceptTorrentLinks")).toHaveCount(0);
      await narration.finishScene(recorder);

      recorder.mark(narrationText[3]);
      await popupCursor.click(popup.getByRole("tab", { name: "Advanced" }));
      await popupCursor.click(popup.getByRole("button", { name: "Add rule" }));
      await popupCursor.click(popup.locator("#routing-0-namePattern"));
      await popup.locator("#routing-0-namePattern").pressSequentially(".iso", { delay: 100 });
      await popupCursor.click(popup.locator("#routing-0-destination"));
      await popup.locator("#routing-0-destination").pressSequentially("dev", { delay: 100 });
      await popup.locator("#routing-0-destination").press("Escape");
      await expect(popup.locator(".routing-rule")).toHaveCount(1);
      await expect(popup.locator("#routing-0-destination")).toHaveValue("dev");
      await narration.finishScene(recorder);

      recorder.mark(narrationText[4]);
      await popupCursor.click(popup.getByRole("tab", { name: "Connection" }));
      await popup.locator("#interceptFileLinks").evaluate((element) => element.scrollIntoView({ block: "center" }));
      await popupCursor.click(popup.getByText("Send file links to Download Station", { exact: true }));
      await expect(popup.locator("#interceptFileLinks")).toBeChecked();
      await popupCursor.click(popup.locator("#save-btn"));
      await expect
        .poll(() =>
          worker.evaluate(async () => {
            const { routingRules, interceptFileLinks } = await chrome.storage.local.get([
              "routingRules",
              "interceptFileLinks",
            ]);
            return { routingRules, interceptFileLinks };
          }),
        )
        .toEqual({ routingRules: [{ namePattern: ".iso", destination: "dev" }], interceptFileLinks: true });
      await narration.finishScene(recorder);
      await closePopupWindow(worker, popupWindowId);

      recorder.mark(narrationText[5]);
      await cursor.click(page.locator("#download-torrent"));
      await expect.poll(() => host.torrentRequestCount(), { timeout: 15_000 }).toBeGreaterThan(0);
      await expect.poll(() => worker.evaluate(() => chrome.action.getBadgeText({})), { timeout: 20_000 }).toBe("1");
      const upload = mockNas.requestLog.toJSON().find((entry) => entry.path.endsWith("/Task/AddTorrent"));
      expect(upload?.requestBody).toMatch(/name="move"\r?\n\r?\ndev\r?\n/);
      await cursor.park();
      await narration.finishScene(recorder);

      recorder.mark(narrationText[6]);
      await cursor.click(page.locator("#download-file"));
      await expect.poll(() => worker.evaluate(() => chrome.action.getBadgeText({})), { timeout: 20_000 }).toBe("2");
      const fileRequest = mockNas.requestLog.toJSON().find((entry) => entry.path.endsWith("/Task/AddUrl"));
      expect(new URLSearchParams(fileRequest?.requestBody).get("move")).toBe("Download");
      await cursor.park();
      await narration.finishScene(recorder);

      await openActionPopup(worker);
      await waitForActionPopupTarget(context, page, extensionId);
      const tasks = await nasTasks(mockNas.port);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].move).toBe("dev");
      expect(tasks[1].move).toBe("Download");
      const firstProgress = tasks[0].progress;
      await expect
        .poll(async () => (await nasTasks(mockNas.port))[0].progress, { timeout: 20_000 })
        .toBeGreaterThan(firstProgress);
      recorder.mark(narrationText[7]);
      await narration.finishScene(recorder);
      await recorder.hold(700);

      recorder.assertRealTime();
    } finally {
      await recorder.stop();
      await context.close();
      await host.close();
      await mockNas.close();
    }

    const srtPath = path.join(outputDir, "demo.en.srt");
    await recorder.writeSrt(srtPath);
    const audioPath = path.join(outputDir, "narration.wav");
    await narration.mix(recorder.sceneMarks, recorder.currentTime, audioPath);
    await finishMaster({
      capturePath: path.join(outputDir, "capture.mov"),
      outputPath: path.join(outputDir, "promo.mp4"),
      subtitles: srtPath,
      narration: audioPath,
      captions: recorder.sceneMarks,
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
async function nasTasks(port: number): Promise<Array<{ progress: number; move: string }>> {
  const response = await fetch(`http://127.0.0.1:${port}/downloadstation/V4/Task/Query`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "from=0&limit=50",
  });
  const payload = (await response.json()) as { data: Array<{ progress: number; move: string }> };
  return payload.data;
}
