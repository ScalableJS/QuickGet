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
 * A plain click on a file link goes to the NAS instead of the browser (RES-5).
 *
 * The assertion that matters is a triple, not a single one: the NAS saw `AddUrl`, the origin
 * server saw **no GET** for that path, and Chrome gained no download. Only together do those
 * prove that no bytes flowed — the whole point of the feature, since it has no size limit.
 *
 * Asserting instead that Playwright saw no `download` event would be weaker than it looks: an
 * extension-initiated download need not belong to the page that was clicked.
 */

type Session = Awaited<ReturnType<typeof launchExtensionPopup>>;

async function configure(session: Session, port: number, interceptFileLinks: boolean): Promise<void> {
  await session.worker.evaluate(
    ({ nasPort, fileLinks }) =>
      chrome.storage.local.set({
        NASaddress: "127.0.0.1",
        NASport: String(nasPort),
        NASsecure: false,
        NASlogin: "admin",
        NASpassword: "demo-password",
        NAStempdir: "Download",
        NASdir: "Movies",
        interceptTorrentLinks: true,
        interceptFileLinks: fileLinks,
        routingRules: [],
      }),
    { nasPort: port, fileLinks: interceptFileLinks },
  );
}

const addUrlBodies = (log: Array<{ path: string; requestBody?: string }>): string[] =>
  log.filter((entry) => entry.path === "/downloadstation/V4/Task/AddUrl").map((entry) => entry.requestBody ?? "");

const getsFor = (log: Array<{ path: string; method: string }>, pathname: string): number =>
  log.filter((entry) => entry.path === pathname && entry.method === "GET").length;

const browserDownloads = (session: Session): Promise<number> =>
  session.worker.evaluate(async () => (await chrome.downloads.search({})).length);

test("off by default: a file link is an ordinary browser download and the NAS hears nothing", async () => {
  const mockNas = await startMockNas();
  const testStand = await startTestStandHost();
  const session = await launchExtensionPopup(extensionDistPath);

  try {
    await waitForPopupReady(session.page);
    // Deliberately not passing the flag at all, so this exercises the stored default rather than
    // an explicit false. The default is the state almost every user will be in.
    await session.worker.evaluate(
      ({ nasPort }) =>
        chrome.storage.local.set({
          NASaddress: "127.0.0.1",
          NASport: String(nasPort),
          NASsecure: false,
          NASlogin: "admin",
          NASpassword: "demo-password",
          NAStempdir: "Download",
          NASdir: "Movies",
          routingRules: [],
        }),
      { nasPort: mockNas.port },
    );

    const standPage = await session.context.newPage();
    await standPage.goto(testStand.url);
    await standPage.click("#tab-btn-direct");

    const download = standPage.waitForEvent("download");
    await standPage.click("#stand-direct-plain-mkv");
    await (await download).cancel();

    await expect.poll(() => getsFor(testStand.requestLog, "/files/plain-clip.mkv")).toBeGreaterThan(0);
    expect(addUrlBodies(mockNas.requestLog.toJSON())).toHaveLength(0);
  } finally {
    await session.close();
    await testStand.close();
    await mockNas.close();
  }
});

test("on: the click reaches the NAS and no bytes flow through the browser", async () => {
  const mockNas = await startMockNas();
  const testStand = await startTestStandHost();
  const session = await launchExtensionPopup(extensionDistPath);

  try {
    await waitForPopupReady(session.page);
    await configure(session, mockNas.port, true);

    const standPage = await session.context.newPage();
    await standPage.goto(testStand.url);
    await standPage.click("#tab-btn-direct");

    const before = await browserDownloads(session);
    await standPage.click("#stand-direct-plain-mkv");

    await expect
      .poll(() => addUrlBodies(mockNas.requestLog.toJSON()).filter((body) => body.includes("plain-clip.mkv")).length, {
        timeout: 15_000,
      })
      .toBe(1);

    // The two halves of "no bytes flowed". Neither alone is enough.
    expect(getsFor(testStand.requestLog, "/files/plain-clip.mkv")).toBe(0);
    expect(await browserDownloads(session)).toBe(before);

    // It is a send like any other, so the destination fields the NAS requires are present.
    const body = addUrlBodies(mockNas.requestLog.toJSON()).find((entry) => entry.includes("plain-clip.mkv")) ?? "";
    expect(body).toContain("temp=");
    expect(body).toContain("move=");
  } finally {
    await session.close();
    await testStand.close();
    await mockNas.close();
  }
});

test("the classifier: query strings, labels and pages decide what is sent", async () => {
  test.setTimeout(120_000);

  const mockNas = await startMockNas();
  const testStand = await startTestStandHost();
  const session = await launchExtensionPopup(extensionDistPath);

  try {
    await waitForPopupReady(session.page);
    await configure(session, mockNas.port, true);

    const standPage = await session.context.newPage();
    await standPage.goto(testStand.url);
    await standPage.click("#tab-btn-direct");

    // Sent: the extension is in the path, whatever the query carries.
    await standPage.click("#stand-direct-token");
    await expect
      .poll(() => addUrlBodies(mockNas.requestLog.toJSON()).some((body) => body.includes("token-clip.mkv")), {
        timeout: 15_000,
      })
      .toBe(true);

    // Sent: no extension anywhere, but the page itself called it a download.
    await standPage.click("#stand-direct-extensionless-download");
    await expect
      .poll(() => addUrlBodies(mockNas.requestLog.toJSON()).some((body) => body.includes("opaque-get")), {
        timeout: 15_000,
      })
      .toBe(true);

    // Sent: a PDF is not claimed by extension, but `download` overrides that — the page saying
    // outright that this is a file beats our default assumption about PDFs.
    await standPage.click("#stand-direct-pdf");
    await expect
      .poll(() => addUrlBodies(mockNas.requestLog.toJSON()).some((body) => body.includes("documentation.pdf")), {
        timeout: 15_000,
      })
      .toBe(true);

    const sentSoFar = addUrlBodies(mockNas.requestLog.toJSON()).length;

    // Not sent: nothing readable says the unlabelled opaque link is a file, so the browser keeps
    // it. The download event is armed before the click, as Playwright requires.
    const unlabelled = standPage.waitForEvent("download", { timeout: 15_000 });
    await standPage.click("#stand-direct-extensionless");
    await (await unlabelled).cancel();

    // Not sent: the same document without `download` belongs in the viewer, not on the NAS.
    // This is the other half of the pair above, and the reason `pdf` is absent from the
    // extension list rather than merely untested.
    await standPage.click("#stand-direct-pdf-bare");
    await standPage.waitForTimeout(2_000);

    // Not sent, and deliberately last: this one navigates, so nothing may need the stand
    // afterwards. An HTML page that merely names a zip in its query is the failure this
    // classifier exists to prevent — sending it would put a web page into Download Station.
    await standPage.click("#stand-direct-query-page");
    await standPage.waitForURL(/page\.html/, { timeout: 15_000 });

    expect(addUrlBodies(mockNas.requestLog.toJSON())).toHaveLength(sentSoFar);
  } finally {
    await session.close();
    await testStand.close();
    await mockNas.close();
  }
});

test("a torrent keeps its own behaviour when the file switch is on", async () => {
  const mockNas = await startMockNas();
  const testStand = await startTestStandHost();
  const session = await launchExtensionPopup(extensionDistPath);

  try {
    await waitForPopupReady(session.page);
    await configure(session, mockNas.port, true);

    const standPage = await session.context.newPage();
    await standPage.goto(testStand.url);
    await standPage.click("#tab-btn-torrents");
    await standPage.click("#stand-torrent-movie");

    // Still AddTorrent, not AddUrl: the file rule must not claim a torrent and quietly convert
    // it from "mirror, keep the local copy" into a NAS-only send.
    await expect
      .poll(
        () =>
          mockNas.requestLog
            .toJSON()
            .some(
              (entry) =>
                entry.path === "/downloadstation/V4/Task/AddTorrent" &&
                entry.requestBody?.includes("big_buck_bunny_1080p.mkv"),
            ),
        { timeout: 20_000 },
      )
      .toBe(true);
    expect(addUrlBodies(mockNas.requestLog.toJSON())).toHaveLength(0);
  } finally {
    await session.close();
    await testStand.close();
    await mockNas.close();
  }
});
