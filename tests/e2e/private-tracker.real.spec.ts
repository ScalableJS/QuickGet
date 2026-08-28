import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { loadTrackerEnv } from "./support/e2eEnv.js";
import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const extensionDistPath = path.resolve(rootDir, "dist");
const profileDir = path.join(rootDir, ".e2e-artifacts", "tracker-profile");
const env = loadTrackerEnv(rootDir);

/**
 * Opt-in, talks to a live third-party site, never gates CI:
 *   npm run test:e2e:tracker
 *
 * `hotlink-guard.spec.ts` already proves the mechanism against a guard that inspects the real
 * headers, and it runs in CI. What only a live site can add is whether a particular tracker
 * accepts what the extension sends — its guard may check more than referer and origin.
 *
 * The site is configured per-machine in .env.e2e.local (TRACKER_E2E_TOPIC) and is not recorded
 * here. A tracker that needs no account works without further setup. For one that does, the
 * session cannot be scripted — anti-bot protection answers a Playwright-driven browser with a
 * challenge page in both headless and headed mode, and no evasion is attempted; log in once
 * with `npm run tracker:login` and this spec reuses that profile.
 */
test.describe("private tracker (live)", () => {
  test.skip(!env.enabled, "Set TRACKER_E2E=1 and TRACKER_E2E_TOPIC in .env.e2e.local to run");
  // A profile is only needed for a tracker that requires an account; an open one runs without.
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test("the tracker accepts the extension's request and yields a real .torrent", async () => {
    const mockNas = await startMockNas();
    const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-tracker-"));
    const session = await launchExtensionPopup(extensionDistPath, {
      downloadsPath,
      // Only a tracker that requires an account needs the saved profile; an open one does not.
      userDataDir: existsSync(profileDir) ? profileDir : undefined,
    });

    try {
      await session.worker.evaluate(
        (values) => chrome.storage.local.set(values as Record<string, unknown>),
        {
          NASaddress: "127.0.0.1",
          NASport: String(mockNas.port),
          NASsecure: false,
          NASlogin: "demo-user",
          NASpassword: "demo-password",
          NAStempdir: "Download",
          NASdir: "Multimedia/Movies",
          torrentInterceptMode: "always",
        } as Record<string, unknown>,
      );

      const page = await session.context.newPage();
      await page.goto(env.topicUrl, { waitUntil: "domcontentloaded" });

      const downloadHref = await page.getAttribute("a.dl-link", "href").catch(() => null);
      test.skip(
        downloadHref === null,
        "No download link on the topic page — the saved session expired; re-run `npm run tracker:login`",
      );
      const downloadUrl = new URL(downloadHref as string, env.topicUrl).toString();

      // 1. The direct question: does an extension-origin fetch get the session cookie?
      const probe = await session.worker.evaluate(async (url) => {
        const response = await fetch(url, { credentials: "include" });
        const bytes = new Uint8Array(await response.clone().arrayBuffer());
        return {
          ok: response.ok,
          contentType: response.headers.get("content-type") ?? "",
          head: Array.from(bytes.slice(0, 2)),
          size: bytes.byteLength,
        };
      }, downloadUrl);

      expect(probe.ok).toBe(true);
      // A .torrent is bencoded: "d" followed by the first key's length digit.
      const bencoded = probe.head[0] === 0x64 && probe.head[1] >= 0x30 && probe.head[1] <= 0x39;
      expect(
        bencoded,
        `expected a bencoded torrent, got ${probe.contentType} (${probe.size} bytes) — the session cookie was probably withheld`,
      ).toBe(true);

      // 2. The whole mechanism: starting the download must put a real torrent on the NAS.
      await page.goto(downloadUrl).catch(() => {});

      await expect
        .poll(() => mockNas.requestLog.includesPath("/downloadstation/V4/Task/AddTorrent"), {
          timeout: 60_000,
        })
        .toBe(true);

      const upload = mockNas.requestLog
        .toJSON()
        .find((entry) => entry.path === "/downloadstation/V4/Task/AddTorrent");
      expect(upload?.requestBody ?? "", "the NAS received HTML instead of a torrent").not.toContain(
        "<html",
      );
    } finally {
      await session.close();
      await mockNas.close();
    }
  });
});
