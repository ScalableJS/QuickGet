import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";
import { waitForPopupReady } from "./support/popup.js";
import { startTestStandHost } from "./support/testStandHost.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");

/**
 * One rule set, every source shape the test stand can produce, one assertion each: what folder
 * did the NAS actually receive?
 *
 * This is the spec that answers "do the rules work, and on what". Individual behaviours are
 * covered elsewhere; the point here is coverage of the *matrix* — magnet vs `.torrent` vs plain
 * download, named URL vs opaque tracker endpoint, single vs multi-file, one host vs another —
 * because every gap in it was a case where routing silently fell through to the default folder
 * and nobody could see it.
 *
 * Rules are ordered; first match wins. The domain rule is deliberately first, so the one case
 * served from another hostname proves ordering as well as domain matching.
 */
const RULES = [
  { domain: "localhost", destination: "R/OtherHost" },
  // A rule that must never fire. If the domain condition were dropped or matched permissively —
  // it used to be stripped from magnet rules entirely — this one would swallow the origin case
  // below and the run would fail, which is the only way to prove the origin match is real.
  { type: "magnet", domain: "never.example.org", namePattern: "avi", destination: "R/WrongSite" },
  { type: "magnet", domain: "127.0.0.1", namePattern: "avi", destination: "R/FromThisSite" },
  { type: "magnet", namePattern: "mkv", destination: "R/MagnetMovies" },
  { type: "magnet", destination: "R/MagnetsAny" },
  { type: "torrent", namePattern: "*S01*", destination: "R/Series" },
  { type: "torrent", namePattern: "mkv", destination: "R/TorrentMovies" },
  { type: "torrent", namePattern: "iso", destination: "R/Images" },
  { type: "url", namePattern: "mkv", destination: "R/DirectMovies" },
];

/**
 * Deliberately the folder the mock's seed task already sits in, so the run has one card that
 * genuinely went to the Target and can be asserted to stay quiet about it. No case below expects
 * the fallback — every one of them matches a rule.
 */
const FALLBACK = "Movies";

type Expectation = {
  /** Row label in the summary table. */
  what: string;
  /** Element on the stand to click. */
  selector: string;
  /** Stand tab the element lives on. */
  tab: "torrents" | "magnets" | "direct" | "tracker";
  /** Substring that identifies this send in the NAS request body. */
  identifies: string;
  /** Folder the NAS must be told to move the finished download to. */
  folder: string;
  /** Which mechanism carries it — a magnet goes through AddUrl, a torrent through AddTorrent. */
  via: "AddUrl" | "AddTorrent";
};

const CASES: Expectation[] = [
  {
    what: "`.torrent` link naming an .mkv",
    selector: "#stand-torrent-movie",
    tab: "torrents",
    identifies: "big_buck_bunny_1080p.mkv",
    folder: "R/TorrentMovies",
    via: "AddTorrent",
  },
  {
    what: "`.torrent` link naming an .iso",
    selector: "#stand-torrent-debian",
    tab: "torrents",
    identifies: "debian-13.6.0-amd64-netinst.iso",
    folder: "R/Images",
    via: "AddTorrent",
  },
  {
    what: "uppercase `.TORRENT` extension",
    selector: "#stand-torrent-uppercase",
    tab: "torrents",
    identifies: "ARCHLINUX-2024.ISO",
    folder: "R/Images",
    via: "AddTorrent",
  },
  {
    // The case the whole engine change was for: nothing in the URL says torrent, and nothing
    // in it names the release.
    what: "opaque tracker endpoint `dl.php`",
    selector: "#stand-tracker-dlphp",
    tab: "tracker",
    identifies: "Tracker.Release.2024.1080p.mkv",
    folder: "R/TorrentMovies",
    via: "AddTorrent",
  },
  {
    what: "MIME only — no filename anywhere outside the file",
    selector: "#stand-tracker-nocd",
    tab: "tracker",
    identifies: "Hidden.Name.Release.2024.mkv",
    folder: "R/TorrentMovies",
    via: "AddTorrent",
  },
  {
    what: "multi-file season pack (directory torrent)",
    selector: "#stand-tracker-multi",
    tab: "tracker",
    identifies: "Some.Show.S01.1080p.WEB-DL",
    folder: "R/Series",
    via: "AddTorrent",
  },
  {
    what: "same torrent from a second hostname (domain rule, first in order)",
    selector: "#stand-tracker-otherhost",
    tab: "tracker",
    identifies: "Domain.Probe.2024.mkv",
    folder: "R/OtherHost",
    via: "AddTorrent",
  },
  {
    what: "magnet with a `dn`",
    selector: "#stand-magnet-movie",
    tab: "magnets",
    identifies: "Documentary.Film.2024.1080p.mkv",
    folder: "R/MagnetMovies",
    via: "AddUrl",
  },
  {
    what: "magnet with no `dn` at all",
    selector: "#stand-magnet-nodn",
    tab: "tracker",
    identifies: "8888888888999999999900000000001111111111",
    folder: "R/MagnetsAny",
    via: "AddUrl",
  },
  {
    // A magnet has no host of its own. The page it was clicked on is the only thing a domain
    // rule can match, and it is what a user means by "where I download from".
    what: "magnet routed by the page it was clicked on, not by the link",
    selector: "#stand-magnet-origin",
    tab: "tracker",
    identifies: "9999999999000000000011111111112222222222",
    folder: "R/FromThisSite",
    via: "AddUrl",
  },
  {
    // The `dn` carries an invalid percent sequence. Nothing may throw, and the rule must still
    // see a usable string rather than an empty one.
    what: "magnet whose `dn` has a broken percent escape",
    selector: "#stand-magnet-malformed",
    tab: "magnets",
    identifies: "5555555555666666666677777777778888888888",
    folder: "R/MagnetMovies",
    via: "AddUrl",
  },
  {
    what: "BitTorrent v2 magnet (`urn:btmh`)",
    selector: "#stand-magnet-v2",
    tab: "tracker",
    identifies: "V2.Hybrid.Release.2024.mkv",
    folder: "R/MagnetMovies",
    via: "AddUrl",
  },
];

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixtures arg before testInfo
test("routing matrix: every source shape the stand can produce lands in the folder its rule names", async ({}, testInfo) => {
  test.setTimeout(120_000);

  const mockNas = await startMockNas();
  const testStand = await startTestStandHost();
  const session = await launchExtensionPopup(extensionDistPath);

  const results: Array<{ what: string; expected: string; actual: string; via: string }> = [];

  try {
    await waitForPopupReady(session.page);
    await session.worker.evaluate(
      ({ port, rules, fallback }) =>
        chrome.storage.local.set({
          NASaddress: "127.0.0.1",
          NASport: String(port),
          NASsecure: false,
          NASlogin: "admin",
          NASpassword: "demo-password",
          NAStempdir: "Download",
          NASdir: fallback,
          autoCaptureMagnets: true,
          torrentInterceptMode: "always",
          routingRules: rules,
        }),
      { port: mockNas.port, rules: RULES, fallback: FALLBACK },
    );

    const standPage = await session.context.newPage();
    await standPage.goto(testStand.url);

    for (const testCase of CASES) {
      await standPage.click(`#tab-btn-${testCase.tab}`);
      await standPage.click(testCase.selector);

      const endpoint = `/downloadstation/V4/Task/${testCase.via}`;
      await expect
        .poll(
          () =>
            mockNas.requestLog
              .toJSON()
              .some((entry) => entry.path === endpoint && entry.requestBody?.includes(testCase.identifies)),
          { message: `no ${testCase.via} carrying ${testCase.identifies}`, timeout: 15_000 },
        )
        .toBe(true);

      const request = mockNas.requestLog
        .toJSON()
        .find((entry) => entry.path === endpoint && entry.requestBody?.includes(testCase.identifies));

      results.push({
        what: testCase.what,
        expected: testCase.folder,
        actual: readMoveField(request?.requestBody ?? "", testCase.via),
        via: testCase.via,
      });
    }

    // A plain download is not a torrent, so the extension must not touch it — which also means a
    // `type: url` rule has nothing to act on here. That is a real product limitation (RES-5), and
    // asserting it keeps the limitation visible instead of leaving it as folklore.
    const beforeDirect = mockNas.requestLog.toJSON().length;
    await standPage.click("#tab-btn-direct");
    await standPage.click("#stand-direct-mkv");
    await standPage.waitForTimeout(2_000);
    const afterDirect = mockNas.requestLog
      .toJSON()
      .slice(beforeDirect)
      .filter((entry) => entry.path.includes("/Task/Add"));
    results.push({
      what: "plain .mkv download (no interception exists — `type: url` cannot fire)",
      expected: "not sent to the NAS",
      actual: afterDirect.length === 0 ? "not sent to the NAS" : `sent via ${afterDirect[0].path}`,
      via: "—",
    });

    // Closing the loop: everything above asserts the *request*. This asserts that the folder a
    // rule chose comes back from the NAS and reaches the user's eyes. A magnet is the case worth
    // spending the check on — it is the only one where routing has neither a filename nor a host
    // of its own to work from, and it is the path the mock used to lie about.
    await session.page.reload({ waitUntil: "domcontentloaded" });
    const magnetCard = session.page
      .locator("#downloads-list .download-item")
      .filter({ hasText: "Documentary.Film.2024.1080p.mkv" });
    await expect(magnetCard).toBeVisible({ timeout: 15_000 });
    await expect(magnetCard.locator(".download-destination")).toHaveText(/R\/MagnetMovies/);

    // And the card stays quiet when the task simply went to the Target folder — the seed task
    // the mock starts with sits in exactly that folder.
    const defaultCard = session.page.locator("#downloads-list .download-item").filter({ hasText: "Ubuntu ISO" });
    await expect(defaultCard).toBeVisible();
    await expect(defaultCard.locator(".download-destination")).toHaveCount(0);

    await testInfo.attach("routing-matrix", {
      body: renderTable(results),
      contentType: "text/markdown",
    });

    const wrong = results.filter((row) => row.actual !== row.expected);
    expect(wrong, `\n${renderTable(results)}`).toEqual([]);
  } catch (error) {
    await testInfo.attach("mock-nas-http-log", {
      body: mockNas.requestLog.toText(),
      contentType: "text/plain",
    });
    if (results.length > 0) {
      await testInfo.attach("routing-matrix-partial", {
        body: renderTable(results),
        contentType: "text/markdown",
      });
    }
    throw error;
  } finally {
    await session.close();
    await testStand.close();
    await mockNas.close();
  }
});

/** `AddUrl` is form-encoded, `AddTorrent` is multipart — the destination field is `move` in both. */
function readMoveField(body: string, via: "AddUrl" | "AddTorrent"): string {
  if (via === "AddUrl") {
    const match = body.match(/(?:^|&)move=([^&]*)/);
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "(no move field)";
  }
  const match = body.match(/name="move"\r?\n\r?\n([^\r\n]*)/);
  return match ? match[1] : "(no move field)";
}

function renderTable(rows: Array<{ what: string; expected: string; actual: string; via: string }>): string {
  const header = "| Source | Sent via | Expected folder | Actual folder | |\n|---|---|---|---|---|";
  const body = rows
    .map(
      (row) =>
        `| ${row.what} | ${row.via} | \`${row.expected}\` | \`${row.actual}\` | ${row.expected === row.actual ? "ok" : "WRONG"} |`,
    )
    .join("\n");
  return `${header}\n${body}\n`;
}
