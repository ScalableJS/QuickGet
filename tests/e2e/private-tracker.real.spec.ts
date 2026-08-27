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
 * It settles the one thing the mocked suites cannot — whether the extension's own
 * `fetch(url, { credentials: "include" })` really carries the user's session on a
 * login-protected site. Chrome treats such a request as same-site when the extension holds a
 * host permission for the target, so the cookie should be attached; this proves it end to end
 * instead of relying on that. If it were withheld, the site would answer with its login page
 * and the NAS would receive HTML — the failure this feature exists to prevent.
 *
 * The session cannot be scripted: anti-bot protection answers a Playwright-driven browser with
 * a challenge page in both headless and headed mode, and no evasion is attempted. Log in once
 * with `npm run tracker:login`; this spec reuses that profile. The target site is configured
 * per-machine in .env.e2e.local and is not recorded here.
 */
test.describe("private tracker (live)", () => {
  test.skip(!env.enabled, "Set TRACKER_E2E=1 and TRACKER_E2E_TOPIC in .env.e2e.local to run");
  test.skip(
    !existsSync(profileDir),
    "No tracker profile yet — run `npm run tracker:login` and log in once",
  );
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test("the extension's fetch carries the session and yields a real .torrent", async () => {
    const mockNas = await startMockNas();
    const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-tracker-"));
    const session = await launchExtensionPopup(extensionDistPath, {
      downloadsPath,
      userDataDir: profileDir,
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
          rememberPassword: false,
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
