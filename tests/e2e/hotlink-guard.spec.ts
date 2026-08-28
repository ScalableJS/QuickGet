import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startGuardedTrackerHost } from "./support/guardedTrackerHost.js";
import { startMockNas } from "./support/mockNas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");
const torrentFixture = path.resolve(__dirname, "fixtures/sample.torrent");

/**
 * The one thing no unit test can settle: whether the request the extension makes is one a
 * tracker's hotlink guard accepts. The guard here inspects the headers Chrome itself attaches,
 * so the outcome depends on where the fetch really runs — not on how it was mocked.
 *
 * A fetch issued by the service worker carries `Origin: chrome-extension://…` and no `Referer`
 * at all (the `referrer` request option cannot change that: the Fetch spec requires it to be
 * same-origin with the request's client). Running it inside a tab already on the site is what
 * makes the request indistinguishable from a click.
 */
test.describe("tracker hotlink guard", () => {
  test.describe.configure({ timeout: 60_000 });

  test("a torrent behind a hotlink guard still reaches the NAS", async () => {
    const tracker = await startGuardedTrackerHost(torrentFixture);
    const nas = await startMockNas();
    const session = await launchExtensionPopup(extensionDistPath);

    try {
      await session.worker.evaluate(
        (values) => chrome.storage.local.set(values as Record<string, unknown>),
        {
          NASaddress: "127.0.0.1",
          NASport: String(nas.port),
          NASsecure: false,
          NASlogin: "demo-user",
          NASpassword: "demo-password",
          NAStempdir: "Download",
          NASdir: "Multimedia/Movies",
          torrentInterceptMode: "always",
          rememberPassword: false,
        } as Record<string, unknown>,
      );

      // The tab has to be open on the tracker — that is the context the fetch borrows.
      const page = await session.context.newPage();
      await page.goto(tracker.topicUrl, { waitUntil: "domcontentloaded" });

      await page.click("a.dl-link");

      await expect
        .poll(() => nas.requestLog.includesPath("/downloadstation/V4/Task/AddTorrent"), {
          timeout: 30_000,
        })
        .toBe(true);

      // The decisive assertion: the guard accepted the extension's request. Had the worker
      // fetched it, every attempt would carry no referer and be refused.
      const accepted = tracker.requests.filter((entry) => !entry.refused);
      expect(accepted.length).toBeGreaterThan(0);
      expect(accepted[0].referer).toContain("/topic");
      // A same-origin GET sends no Origin at all — which is the point: from the worker it
      // would have carried the extension's, and the guard rejects that.
      expect(accepted[0].origin).toBeNull();
      expect(accepted[0].secFetchSite).toBe("same-origin");

      const upload = nas.requestLog
        .toJSON()
        .find((entry) => entry.path === "/downloadstation/V4/Task/AddTorrent");
      expect(upload?.requestBody ?? "", "the NAS received the guard's HTML, not a torrent").not.toContain(
        "Hotlinking is not allowed",
      );
    } finally {
      await session.close();
      await nas.close();
      await tracker.close();
    }
  });

  test("reports the refusal instead of uploading the guard's page as a torrent", async () => {
    const tracker = await startGuardedTrackerHost(torrentFixture);
    const nas = await startMockNas();
    const session = await launchExtensionPopup(extensionDistPath);

    try {
      await session.worker.evaluate(
        (values) => chrome.storage.local.set(values as Record<string, unknown>),
        {
          NASaddress: "127.0.0.1",
          NASport: String(nas.port),
          NASsecure: false,
          NASlogin: "demo-user",
          NASpassword: "demo-password",
          NAStempdir: "Download",
          NASdir: "Multimedia/Movies",
          torrentInterceptMode: "always",
          rememberPassword: false,
        } as Record<string, unknown>,
      );

      // No tab on the tracker, so the fetch falls back to the worker and the guard refuses it.
      const refusal = await session.worker.evaluate(async (url) => {
        const response = await fetch(url, { credentials: "include" });
        return response.status;
      }, tracker.downloadUrl);

      expect(refusal).toBe(403);
      expect(tracker.requests[tracker.requests.length - 1]?.refused).toBe(true);
      // Nothing was handed to the NAS on the strength of a refusal.
      expect(nas.requestLog.includesPath("/downloadstation/V4/Task/AddTorrent")).toBe(false);
    } finally {
      await session.close();
      await nas.close();
      await tracker.close();
    }
  });
});
