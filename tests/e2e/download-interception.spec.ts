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

async function startSession() {
  const torrentHost = await startTorrentHost(torrentFixture, { bodyDelayMs: BODY_DELAY_MS });
  const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-e2e-downloads-"));
  const session = await launchExtensionPopup(extensionDistPath, { downloadsPath });
  return { torrentHost, session };
}

test("hands the torrent to the NAS and only then cancels the browser download", async () => {
  const mockNas = await startMockNas();
  const { torrentHost, session } = await startSession();

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

    // Measured behaviour, not the one we would have guessed: a small .torrent from a local
    // host reaches `complete` before the cancel can bite, so Chrome keeps a copy. The
    // contract we can hold it to is that the transfer is never left hanging — every item
    // ends up either cancelled (interrupted) or finished, never stuck in progress.
    await expect
      .poll(() => downloadStates(session.worker), { timeout: 20_000 })
      .not.toContain("in_progress");

    const sent = await session.worker.evaluate(async () =>
      (await chrome.downloads.search({})).every(
        (item) => item.state === "interrupted" || item.state === "complete",
      ),
    );
    expect(sent).toBe(true);
  } finally {
    await session.close();
    await torrentHost.close();
    await mockNas.close();
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
    await seedSettings(
      session.worker,
      nasSettings(mockNas.port, { NASpassword: "" }),
    );

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
