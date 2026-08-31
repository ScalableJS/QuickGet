import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Worker } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";
import { startTorrentHost } from "./support/torrentHost.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");
const torrentFixture = path.resolve(__dirname, "fixtures/sample.torrent");

/**
 * Unit tests prove the extension calls the right `chrome.downloads` methods in the right order.
 * Only here does a real Chrome start, pause, cancel and resume a download — a mocked
 * `chrome.downloads.resume()` can never show that the browser actually finishes the transfer.
 *
 * The torrent host delays its body: a small `.torrent` from localhost otherwise completes
 * before the extension can pause it, and the transaction under test never happens.
 */
const BODY_DELAY_MS = 3_000;

type Settings = Record<string, unknown>;

function seedSettings(worker: Worker, settings: Settings): Promise<unknown> {
  return worker.evaluate((values) => chrome.storage.local.set(values as Settings), settings);
}

function downloadStates(worker: Worker): Promise<string[]> {
  return worker.evaluate(async () => (await chrome.downloads.search({})).map((item) => item.state));
}

function actionBadge(worker: Worker): Promise<{ text: string; color: chrome.extensionTypes.ColorArray }> {
  return worker.evaluate(async () => ({
    text: await chrome.action.getBadgeText({}),
    color: await chrome.action.getBadgeBackgroundColor({}),
  }));
}

function toolbarState(worker: Worker): Promise<{ badgeText?: string; icon?: string }> {
  return worker.evaluate(async () => {
    const stored = await chrome.storage.session.get("qg:toolbarState");
    return (stored["qg:toolbarState"] ?? {}) as { badgeText?: string; icon?: string };
  });
}

function nasSettings(port: number, overrides: Settings = {}): Settings {
  return {
    NASaddress: "127.0.0.1",
    NASport: String(port),
    NASsecure: false,
    NASlogin: "demo-user",
    NASpassword: "demo-password",
    NAStempdir: "Download",
    NASdir: "Multimedia/Movies",
    torrentInterceptMode: "always",
    ...overrides,
  };
}

async function startSession(options: { bodyDelayMs?: number; userDataDir?: string } = {}) {
  const torrentHost = await startTorrentHost(torrentFixture, options);
  const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-e2e-downloads-"));
  const session = await launchExtensionPopup(extensionDistPath, {
    downloadsPath,
    userDataDir: options.userDataDir,
  });
  return { torrentHost, session };
}

test("does not retain an intercepted torrent through a browser restart", async () => {
  const mockNas = await startMockNas();
  const userDataDir = await mkdtemp(path.join(tmpdir(), "qg-e2e-restart-profile-"));
  const { torrentHost, session } = await startSession({ bodyDelayMs: BODY_DELAY_MS, userDataDir });
  let reopenedSession: Awaited<ReturnType<typeof launchExtensionPopup>> | undefined;

  try {
    await seedSettings(session.worker, nasSettings(mockNas.port));
    const page = await session.context.newPage();
    await page.goto(torrentHost.url).catch(() => {
      // Navigating to an attachment aborts the navigation; the download is what matters.
    });

    await expect
      .poll(() => mockNas.requestLog.includesPath("/downloadstation/V4/Task/AddTorrent"), {
        timeout: 30_000,
      })
      .toBe(true);

    // Close and reopen the real Chromium profile. The NAS has received exactly one torrent;
    // a startup path in the extension must not upload it again without a new browser download.
    await session.close();
    reopenedSession = await launchExtensionPopup(extensionDistPath, { userDataDir });
    const addTorrentCount = mockNas.requestLog
      .toJSON()
      .filter((request) => request.path === "/downloadstation/V4/Task/AddTorrent").length;
    expect(addTorrentCount).toBe(1);

    // A successful hand-off must leave no DownloadItem in the persistent Chrome profile.
    const retained = await reopenedSession.worker.evaluate(async () =>
      (await chrome.downloads.search({})).map((item) => ({
        filename: item.filename,
        id: item.id,
        state: item.state,
        url: item.finalUrl || item.url,
      })),
    );
    expect(retained).toEqual([]);
  } finally {
    await reopenedSession?.close();
    await torrentHost.close();
    await mockNas.close();
  }
});

test("returns the toolbar to idle as soon as the popup snapshot is empty", async () => {
  const session = await launchExtensionPopup(extensionDistPath);

  try {
    // This is a toolbar-state test, not a configuration/monitoring test. Let the popup's initial
    // unconfigured refresh finish, then remove that context so BUG-22 cannot correctly replace
    // our synthetic active state with an attention badge mid-assertion.
    await session.page.close();
    await expect.poll(() => session.worker.evaluate(() => chrome.alarms.get("download-monitor"))).toBeUndefined();
    const messagePage = await session.context.newPage();
    await messagePage.goto(`chrome-extension://${session.extensionId}/manifest.json`);

    const sendSnapshot = (active: number) =>
      messagePage.evaluate(
        (count) =>
          chrome.runtime.sendMessage({
            type: "qg:badgeSnapshot",
            stats: { active: count, all: count, downRate: 0, upRate: 0 },
          }),
        active,
      );

    await sendSnapshot(1);
    await expect.poll(() => actionBadge(session.worker)).toMatchObject({ text: "1" });
    await expect.poll(() => toolbarState(session.worker)).toMatchObject({ icon: "active" });

    await sendSnapshot(0);
    await expect.poll(() => toolbarState(session.worker)).toMatchObject({ badgeText: "", icon: "idle" });
    expect(await actionBadge(session.worker)).toMatchObject({ text: "" });
  } finally {
    await session.close();
  }
});

test("updates the toolbar once per meaningful NAS count change", async () => {
  const session = await launchExtensionPopup(extensionDistPath);

  try {
    // Isolate the synthetic toolbar trace from the popup's real unconfigured refresh. Otherwise
    // that refresh can finish after the reset below and correctly replace it with BUG-22's
    // attention state, making the measurement depend on runner timing.
    await session.page.close();
    await expect.poll(() => session.worker.evaluate(() => chrome.alarms.get("download-monitor"))).toBeUndefined();
    const messagePage = await session.context.newPage();
    await messagePage.goto(`chrome-extension://${session.extensionId}/manifest.json`);

    await session.worker.evaluate(async () => {
      await chrome.action.setBadgeText({ text: "" });
      await chrome.action.setIcon({ path: { 32: "icons/32_download.png", 128: "icons/128_download.png" } });
      await chrome.storage.session.set({
        "qg:toolbarState": {
          badgeText: "",
          icon: "idle",
          badgeColor: null,
          title: "",
          failureReason: null,
          failureRevision: 0,
        },
      });

      const action = chrome.action as typeof chrome.action & {
        __qgWrites?: Array<{ kind: string; value: string; at: number }>;
      };
      action.__qgWrites = [];
      const originalBadge = action.setBadgeText.bind(action);
      const originalIcon = action.setIcon.bind(action);
      const originalColor = action.setBadgeBackgroundColor.bind(action);
      const originalTitle = action.setTitle.bind(action);

      action.setBadgeText = async (details) => {
        action.__qgWrites?.push({ kind: "badge", value: details.text ?? "", at: performance.now() });
        return originalBadge(details);
      };
      action.setIcon = async (details) => {
        action.__qgWrites?.push({ kind: "icon", value: "paint", at: performance.now() });
        return originalIcon(details);
      };
      action.setBadgeBackgroundColor = async (details) => {
        action.__qgWrites?.push({ kind: "color", value: String(details.color), at: performance.now() });
        return originalColor(details);
      };
      action.setTitle = async (details) => {
        action.__qgWrites?.push({ kind: "title", value: details.title ?? "", at: performance.now() });
        return originalTitle(details);
      };
    });

    const sendAndWait = async (active: number, expectedBadge: string) => {
      await messagePage.evaluate((count) => {
        chrome.runtime.sendMessage({
          type: "qg:badgeSnapshot",
          stats: { active: count, all: count, downRate: 0, upRate: 0 },
        });
      }, active);
      await expect
        .poll(() => toolbarState(session.worker))
        .toMatchObject({
          badgeText: expectedBadge,
        });
    };

    // Repeated snapshots model normal popup + alarm overlap. They must not repaint anything.
    await sendAndWait(1, "1"); // start
    await sendAndWait(1, "1"); // duplicate
    await sendAndWait(2, "2"); // increment
    await sendAndWait(2, "2"); // duplicate
    await sendAndWait(1, "1"); // decrement
    await sendAndWait(1, "1"); // duplicate
    await sendAndWait(0, ""); // the first successful NAS zero is authoritative

    const measurements = await session.worker.evaluate(() => {
      const writes =
        (
          chrome.action as typeof chrome.action & {
            __qgWrites?: Array<{ kind: string; value: string; at: number }>;
          }
        ).__qgWrites ?? [];
      const firstWriteAt = writes[0]?.at ?? 0;
      const lastWriteAt = writes[writes.length - 1]?.at ?? 0;
      return {
        writes,
        elapsedMs: lastWriteAt - firstWriteAt,
      };
    });

    expect(measurements.writes.filter(({ kind }) => kind === "badge").map(({ value }) => value)).toEqual([
      "1",
      "2",
      "1",
      "",
    ]);
    expect(measurements.writes.filter(({ kind }) => kind === "icon")).toHaveLength(2);
    expect(measurements.writes.filter(({ kind }) => kind === "color")).toHaveLength(1);
    expect(measurements.writes.filter(({ kind }) => kind === "title")).toHaveLength(4);
    expect(measurements.elapsedMs).toBeLessThan(2_000);

    console.log("toolbar transition measurements", measurements);
  } finally {
    await session.close();
  }
});

test("lets the browser finish the download when the NAS is unreachable", async () => {
  // The regression that started all this: the download used to be cancelled up front, so an
  // offline NAS meant no file and no task. Nothing listens on this port.
  const deadNasPort = 9;
  const { torrentHost, session } = await startSession();

  try {
    await seedSettings(session.worker, nasSettings(deadNasPort));

    const page = await session.context.newPage();
    await page.goto(torrentHost.url).catch(() => {});

    await expect.poll(() => downloadStates(session.worker), { timeout: 30_000 }).toContain("complete");
    expect(await downloadStates(session.worker)).not.toContain("interrupted");
    await expect.poll(() => actionBadge(session.worker)).toEqual({ text: "!", color: [217, 48, 37, 255] });
  } finally {
    await session.close();
    await torrentHost.close();
  }
});

test("leaves the download alone when no NAS credentials are available", async () => {
  const mockNas = await startMockNas();
  const { torrentHost, session } = await startSession();

  try {
    // Interception on and the NAS reachable, but the master password was never entered.
    await seedSettings(session.worker, nasSettings(mockNas.port, { NASpassword: "" }));

    const page = await session.context.newPage();
    await page.goto(torrentHost.url).catch(() => {});

    await expect.poll(() => downloadStates(session.worker), { timeout: 30_000 }).toContain("complete");
    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/AddTorrent")).toBe(false);
  } finally {
    await session.close();
    await torrentHost.close();
    await mockNas.close();
  }
});

/**
 * Cannot be verified here, and skipping is the honest outcome rather than asserting something
 * weaker and calling it proof.
 *
 * `chrome.downloads.onDeterminingFilename` never fires under Playwright's persistent context:
 * the automation harness assigns each download a target path itself (files land in
 * `.playwright-artifacts-*`), so the filename-determination stage — the only point where the
 * transfer can be cancelled before Chrome commits a file — is bypassed entirely. Verified by
 * probing the running worker: the listener registers, the event never arrives.
 *
 * Strict mode therefore has to be checked by hand in a real Chrome profile:
 *   1. Settings → tick "Don't keep the .torrent file locally".
 *   2. Chrome Settings → turn ON "Ask where to save each file before downloading".
 *   3. Click a .torrent link: no "Save as" prompt, no file in Downloads, task on the NAS.
 */
test.skip("strict mode leaves no .torrent in the browser when the NAS accepts it", async () => {
  const mockNas = await startMockNas();
  // No body delay on purpose: this is the race the permissive path loses. A small .torrent
  // from localhost would normally reach `complete` before any cancel could bite, so if the
  // file is still absent here it is the filename-stage cancel that kept it away.
  const { torrentHost, session } = await startSession();

  try {
    await seedSettings(session.worker, nasSettings(mockNas.port, { suppressLocalTorrentFile: true }));

    const page = await session.context.newPage();
    await page.goto(torrentHost.url).catch(() => {
      // Navigating to an attachment aborts the navigation; the download is what matters.
    });

    await expect
      .poll(() => mockNas.requestLog.includesPath("/downloadstation/V4/Task/AddTorrent"), {
        timeout: 30_000,
      })
      .toBe(true);

    // The whole point of the mode: nothing is left for the user to find in Downloads.
    await expect.poll(() => downloadStates(session.worker), { timeout: 20_000 }).not.toContain("in_progress");

    const states = await downloadStates(session.worker);
    expect(states).not.toContain("complete");
  } finally {
    await session.close();
    await torrentHost.close();
    await mockNas.close();
  }
});
