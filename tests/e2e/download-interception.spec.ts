import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Worker } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";
import { startTestStandHost } from "./support/testStandHost.js";
import { startTorrentHost } from "./support/torrentHost.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");
const torrentFixture = path.resolve(__dirname, "fixtures/sample.torrent");

/**
 * Unit tests prove that ordinary interception never calls a destructive downloads API. Only
 * here does real Chromium prove the paired user outcome: NAS receives the torrent and the
 * browser still retains its own local download.
 *
 * The torrent host can delay its body when a test needs a stable in-progress browser download.
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
    interceptTorrentLinks: true,
    ...overrides,
  };
}

async function startSession(options: { bodyDelayMs?: number; userDataDir?: string; nativeDownloads?: boolean } = {}) {
  const torrentHost = await startTorrentHost(torrentFixture, options);
  const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-e2e-downloads-"));
  const session = await launchExtensionPopup(extensionDistPath, {
    downloadsPath,
    userDataDir: options.userDataDir,
    nativeDownloads: options.nativeDownloads,
  });
  return { torrentHost, session, downloadsPath };
}

test("retains an ordinary intercepted torrent through a browser restart", async () => {
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

    // Ordinary interception is intentionally a dual outcome: NAS receives the task, while the
    // browser keeps its own file and DownloadItem as the user's local fallback.
    const retained = await reopenedSession.worker.evaluate(async () =>
      (await chrome.downloads.search({})).map((item) => ({
        filename: item.filename,
        id: item.id,
        state: item.state,
        url: item.finalUrl || item.url,
      })),
    );
    expect(retained).toHaveLength(1);
    expect(retained[0]).toMatchObject({ state: "complete", url: torrentHost.url });
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

    const sendSnapshot = (downloading: number) =>
      messagePage.evaluate(
        (count) =>
          chrome.runtime.sendMessage({
            type: "qg:badgeSnapshot",
            stats: { downloading: count, seeding: 0, all: count, downRate: 0, upRate: 0 },
          }),
        downloading,
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

    const sendAndWait = async (downloading: number, seeding: number, expected: { badgeText: string; icon: string }) => {
      await messagePage.evaluate(
        ({ down, seed }) => {
          chrome.runtime.sendMessage({
            type: "qg:badgeSnapshot",
            stats: { downloading: down, seeding: seed, all: down + seed, downRate: 0, upRate: 0 },
          });
        },
        { down: downloading, seed: seeding },
      );
      await expect.poll(() => toolbarState(session.worker)).toMatchObject(expected);
    };

    // Repeated snapshots model normal popup + alarm overlap. They must not repaint anything.
    await sendAndWait(1, 0, { badgeText: "1", icon: "active" }); // start
    await sendAndWait(1, 0, { badgeText: "1", icon: "active" }); // duplicate
    await sendAndWait(2, 0, { badgeText: "2", icon: "active" }); // increment
    await sendAndWait(2, 0, { badgeText: "2", icon: "active" }); // duplicate
    await sendAndWait(1, 0, { badgeText: "1", icon: "active" }); // decrement
    await sendAndWait(1, 0, { badgeText: "1", icon: "active" }); // duplicate

    // BUG-62: one download plus two seeds. The number is the download, never the sum.
    await sendAndWait(1, 2, { badgeText: "1", icon: "active" });
    expect(await actionBadge(session.worker)).toMatchObject({ text: "1" });

    // The last download finishes and the NAS moves it to seeding: the number goes away while the
    // icon stays lit. That transition *is* the completion signal — no notification is involved.
    await sendAndWait(0, 3, { badgeText: "", icon: "active" });
    expect(await actionBadge(session.worker)).toMatchObject({ text: "" });

    // Seeding finishes too — only now is the toolbar idle.
    await sendAndWait(0, 0, { badgeText: "", icon: "idle" });

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

    // Duplicates and the seeding-only step add no badge write; the diff guard still holds.
    expect(measurements.writes.filter(({ kind }) => kind === "badge").map(({ value }) => value)).toEqual([
      "1",
      "2",
      "1",
      "",
    ]);
    // Lit once at the start, dimmed once at the very end — the seeding-only step in between must
    // not repaint it, or the completion transition would flicker through idle.
    expect(measurements.writes.filter(({ kind }) => kind === "icon")).toHaveLength(2);
    expect(measurements.writes.filter(({ kind }) => kind === "color")).toHaveLength(1);
    // Six distinct tooltips: the seeding counts differ even where the badge text does not.
    expect(measurements.writes.filter(({ kind }) => kind === "title")).toHaveLength(6);
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

test("native download test writes its control file to the browser directory", async () => {
  // Proves that `nativeDownloads` points Chromium at the directory inspected by the paired
  // ordinary-torrent test below.
  const stand = await startTestStandHost();
  const { session, downloadsPath } = await startSession({ nativeDownloads: true });

  try {
    const page = await session.context.newPage();
    await page.goto(`${stand.url}files/sample-clip.mkv`).catch(() => {
      // Navigating to an attachment aborts the navigation; the download is what matters.
    });

    await expect.poll(() => readdir(downloadsPath), { timeout: 20_000 }).toContain("sample-clip.mkv");
  } finally {
    await session.close();
    await stand.close();
  }
});

test("ordinary torrent click sends to NAS and keeps the local file", async () => {
  const mockNas = await startMockNas();
  const { torrentHost, session, downloadsPath } = await startSession({ nativeDownloads: true });

  try {
    await seedSettings(session.worker, nasSettings(mockNas.port, { interceptTorrentLinks: true }));

    const page = await session.context.newPage();
    await page.goto(torrentHost.url).catch(() => {
      // Navigating to an attachment aborts the navigation; the download is what matters.
    });

    await expect
      .poll(() => mockNas.requestLog.includesPath("/downloadstation/V4/Task/AddTorrent"), { timeout: 30_000 })
      .toBe(true);

    await expect.poll(() => readdir(downloadsPath), { timeout: 30_000 }).toContain("sample.torrent");
    await expect.poll(() => session.worker.evaluate(async () => (await chrome.downloads.search({})).length)).toBe(1);
  } finally {
    await session.close();
    await torrentHost.close();
    await mockNas.close();
  }
});
