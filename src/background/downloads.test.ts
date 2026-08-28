import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestSettings } from "../../tests/fixtures/settings.js";
import {
  createDownloadItem,
  getChromeDownloadsMock,
  getChromeNotificationsMock,
  getChromeSessionStorageSnapshot,
  getChromeScriptingMock,
  getChromeTabsMock,
  seedChromeSessionStorage,
  seedChromeStorage,
  seedOpenTab,
} from "../../tests/mocks/chrome.js";
import { server } from "../../tests/msw/server.js";

vi.mock("./alarms.js", () => ({
  ensureMonitoring: vi.fn(),
}));

import { handleDownloadCreated, recoverAbandonedHandoffs } from "./downloads.js";

const TORRENT_URL = "https://tracker.example.com/file.torrent";

/** Serve the .torrent itself plus the NAS endpoints a successful hand-off needs. */
function mockSuccessfulHandoff(): { addTorrentCalls: number } {
  const counter = { addTorrentCalls: 0 };

  server.use(
    http.get(TORRENT_URL, () =>
      HttpResponse.arrayBuffer(new TextEncoder().encode("d8:announce…e").buffer as ArrayBuffer, {
        headers: { "content-type": "application/x-bittorrent" },
      }),
    ),
    http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
      HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
    ),
    http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", () => {
      counter.addTorrentCalls += 1;
      return HttpResponse.json({ error: 0 });
    }),
  );

  return counter;
}

/** The torrent is fetched fine, but the NAS refuses the task. */
function mockFailedHandoff(): void {
  server.use(
    http.get(TORRENT_URL, () =>
      HttpResponse.arrayBuffer(new TextEncoder().encode("d8:announce…e").buffer as ArrayBuffer, {
        headers: { "content-type": "application/x-bittorrent" },
      }),
    ),
    http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
      HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
    ),
    http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", () =>
      HttpResponse.json({ error: 4096, reason: "temp" }),
    ),
  );
}

describe("download interception", () => {
  let downloads: ReturnType<typeof getChromeDownloadsMock>;
  let notifications: ReturnType<typeof getChromeNotificationsMock>;

  beforeEach(() => {
    downloads = getChromeDownloadsMock();
    notifications = getChromeNotificationsMock();
  });

  it("ignores the download entirely when interception is off", async () => {
    seedChromeStorage(createTestSettings({ torrentInterceptMode: "off" }));

    await handleDownloadCreated(createDownloadItem());

    expect(downloads.cancel).not.toHaveBeenCalled();
    expect(downloads.pause).not.toHaveBeenCalled();
  });

  it("leaves non-torrent downloads to the browser", async () => {
    seedChromeStorage(createTestSettings());

    await handleDownloadCreated(
      createDownloadItem({
        url: "https://example.com/photo.jpg",
        finalUrl: "https://example.com/photo.jpg",
        filename: "photo.jpg",
        mime: "image/jpeg",
      }),
    );

    expect(downloads.cancel).not.toHaveBeenCalled();
    expect(downloads.pause).not.toHaveBeenCalled();
  });

  it("cancels the browser download only after the NAS accepted the torrent", async () => {
    seedChromeStorage(createTestSettings());
    const nas = mockSuccessfulHandoff();

    await handleDownloadCreated(createDownloadItem());

    expect(nas.addTorrentCalls).toBe(1);
    expect(downloads.pause).toHaveBeenCalledWith(1);
    expect(downloads.cancel).toHaveBeenCalledWith(1);
    expect(downloads.resume).not.toHaveBeenCalled();

    const pausedAt = downloads.pause.mock.invocationCallOrder[0];
    const cancelledAt = downloads.cancel.mock.invocationCallOrder[0];
    expect(pausedAt).toBeLessThan(cancelledAt);
  });

  it("holds the cancel until AddTorrent actually resolves", async () => {
    // Ordering alone is too weak: `pause → cancel → send` satisfies it. Gate the NAS response
    // so the assertion happens while the hand-off is still in flight.
    seedChromeStorage(createTestSettings());

    let releaseAddTorrent!: () => void;
    let signalAddTorrentReached!: () => void;
    const addTorrentGate = new Promise<void>((resolve) => {
      releaseAddTorrent = resolve;
    });
    const addTorrentReached = new Promise<void>((resolve) => {
      signalAddTorrentReached = resolve;
    });

    server.use(
      http.get(TORRENT_URL, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode("d8:announce…e").buffer as ArrayBuffer, {
          headers: { "content-type": "application/x-bittorrent" },
        }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", async () => {
        signalAddTorrentReached();
        await addTorrentGate;
        return HttpResponse.json({ error: 0 });
      }),
    );

    const handling = handleDownloadCreated(createDownloadItem());
    await addTorrentReached;

    expect(downloads.pause).toHaveBeenCalledWith(1);
    expect(downloads.cancel).not.toHaveBeenCalled();

    releaseAddTorrent();
    await handling;

    expect(downloads.cancel).toHaveBeenCalledWith(1);
  });

  it("does not resume a download that was never paused", async () => {
    seedChromeStorage(createTestSettings());
    downloads.pause.mockRejectedValueOnce(new Error("download already complete"));
    mockFailedHandoff();

    await handleDownloadCreated(createDownloadItem());

    expect(downloads.resume).not.toHaveBeenCalled();
    expect(downloads.cancel).not.toHaveBeenCalled();
  });

  it("puts the transfer back to the browser when the cancel fails after a successful send", async () => {
    seedChromeStorage(createTestSettings());
    mockSuccessfulHandoff();
    downloads.cancel.mockRejectedValueOnce(new Error("not cancellable"));

    await handleDownloadCreated(createDownloadItem());

    // The NAS has the torrent, but the browser transfer must not be left hanging paused.
    expect(downloads.resume).toHaveBeenCalledWith(1);
  });

  it("reports the paused state honestly when the resume also fails", async () => {
    seedChromeStorage(createTestSettings());
    mockFailedHandoff();
    downloads.resume.mockRejectedValueOnce(new Error("cannot resume"));

    await handleDownloadCreated(createDownloadItem());

    const calls = notifications.create.mock.calls;
    const options = calls[calls.length - 1][0] as { message: string };
    expect(options.message).toContain("paused");
    expect(options.message).not.toContain("resumed");
  });

  it("resumes the browser download when the NAS rejects the torrent", async () => {
    seedChromeStorage(createTestSettings());
    mockFailedHandoff();

    await handleDownloadCreated(createDownloadItem());

    expect(downloads.resume).toHaveBeenCalledWith(1);
    expect(downloads.cancel).not.toHaveBeenCalled();
  });

  it("works from the normal session-credential state, not just a legacy local password", async () => {
    // rememberPassword=false keeps the password in storage.session; local holds none.
    seedChromeStorage(createTestSettings({ NASpassword: "", rememberPassword: false }));
    seedChromeSessionStorage({ sessionNASpassword: "secret" });
    const nas = mockSuccessfulHandoff();

    await handleDownloadCreated(createDownloadItem());

    expect(nas.addTorrentCalls).toBe(1);
    expect(downloads.cancel).toHaveBeenCalledWith(1);
  });

  it("handles a torrent whose extension is followed by a fragment", async () => {
    seedChromeStorage(createTestSettings());
    const url = "https://tracker.example.com/file.torrent#pk";
    server.use(
      http.get(url, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode("d8:announce…e").buffer as ArrayBuffer),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", () =>
        HttpResponse.json({ error: 0 }),
      ),
    );

    await handleDownloadCreated(createDownloadItem({ url, finalUrl: url, mime: "application/octet-stream" }));

    expect(downloads.cancel).toHaveBeenCalledWith(1);
  });

  it("recognises a torrent by filename when the URL and MIME say nothing", async () => {
    seedChromeStorage(createTestSettings());
    const url = "https://tracker.example.com/download?id=1234";
    server.use(
      http.get(url, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode("d8:announce…e").buffer as ArrayBuffer),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", () =>
        HttpResponse.json({ error: 0 }),
      ),
    );

    await handleDownloadCreated(
      createDownloadItem({
        url,
        finalUrl: url,
        mime: "application/octet-stream",
        filename: "/Users/me/Downloads/Ubuntu.torrent",
      }),
    );

    expect(downloads.cancel).toHaveBeenCalledWith(1);
  });

  it("sends a download only once when onCreated and onChanged both recognise it", async () => {
    seedChromeStorage(createTestSettings());
    const nas = mockSuccessfulHandoff();
    const item = createDownloadItem();

    await handleDownloadCreated(item);
    await handleDownloadCreated(item); // the onChanged path arriving for the same id

    expect(nas.addTorrentCalls).toBe(1);
    expect(downloads.cancel).toHaveBeenCalledTimes(1);
  });

  it("sends only once when both listeners fire concurrently", async () => {
    // Found in E2E, not here: sequential calls are settled by the session marker, but two
    // concurrent ones both read it as unset and sent the torrent twice. The claim has to be
    // taken synchronously, before the first await.
    seedChromeStorage(createTestSettings());
    const nas = mockSuccessfulHandoff();
    const item = createDownloadItem();

    await Promise.all([handleDownloadCreated(item), handleDownloadCreated(item)]);

    expect(nas.addTorrentCalls).toBe(1);
    expect(downloads.cancel).toHaveBeenCalledTimes(1);
  });

  it("releases a download abandoned by a service worker that died mid-hand-off", async () => {
    seedChromeSessionStorage({ "qg-pending-7": true, sessionNASpassword: "secret" });

    await recoverAbandonedHandoffs();

    expect(downloads.resume).toHaveBeenCalledWith(7);
    expect(getChromeSessionStorageSnapshot()["qg-pending-7"]).toBeUndefined();
    // Unrelated session keys must survive the sweep.
    expect(getChromeSessionStorageSnapshot().sessionNASpassword).toBe("secret");
  });

  it("clears the pending marker once the hand-off reached a terminal action", async () => {
    seedChromeStorage(createTestSettings());
    mockSuccessfulHandoff();

    await handleDownloadCreated(createDownloadItem());

    expect(getChromeSessionStorageSnapshot()["qg-pending-1"]).toBeUndefined();
  });

  it("leaves the download alone when the NAS address is not configured", async () => {
    seedChromeStorage(createTestSettings({ NASaddress: "" }));

    await handleDownloadCreated(createDownloadItem());

    expect(downloads.pause).not.toHaveBeenCalled();
    expect(downloads.cancel).not.toHaveBeenCalled();
  });

  it("never touches the download while the master password is locked", async () => {
    // A real lock needs the encrypted blob present and the session empty — without the blob
    // isLocked() returns false and this would only exercise the generic empty-password path.
    seedChromeStorage({
      ...createTestSettings({ NASpassword: "", rememberPassword: true }),
      encryptedNASpassword: { ciphertext: "AAAA", iv: "BBBB", salt: "CCCC" },
    });

    await handleDownloadCreated(createDownloadItem());

    expect(downloads.cancel).not.toHaveBeenCalled();
    expect(downloads.pause).not.toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "QuickGet is locked" }),
    );
  });

  it("never touches the download when the session password was cleared by a restart", async () => {
    // rememberPassword=false: the password lives only in storage.session, which a browser
    // restart empties. isLocked() reports false here, so it alone is not a sufficient guard.
    seedChromeStorage(
      createTestSettings({ NASpassword: "", rememberPassword: false, torrentInterceptMode: "always" }),
    );

    await handleDownloadCreated(createDownloadItem());

    expect(downloads.cancel).not.toHaveBeenCalled();
    expect(downloads.pause).not.toHaveBeenCalled();
  });
});

/**
 * A tracker's hotlink guard refuses a request that does not look like a click from its own
 * pages. The service worker cannot produce one: `Referer` is unsettable from there (the Fetch
 * spec discards a cross-origin `referrer`), and the request still carries the extension's
 * origin. So the fetch is delegated to a tab already on the site, where all of that is native.
 */
describe("download interception — page-context fetch", () => {
  const GUARDED_URL = "https://tracker.example.com/forum/dl.php?t=6645249";
  const TOPIC_URL = "https://tracker.example.com/forum/viewtopic.php?t=6645249";
  const OTHER_TOPIC = "https://tracker.example.com/forum/viewtopic.php?t=1";

  beforeEach(() => {
    seedChromeStorage(createTestSettings());
    mockNasAccepts();
  });

  function mockNasAccepts(): void {
    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", () =>
        HttpResponse.json({ error: 0 }),
      ),
    );
  }

  /** Stands in for the page: returns the torrent base64-encoded, as the injected code does. */
  function pageReturnsTorrent(): void {
    getChromeScriptingMock().executeScript.mockResolvedValue([
      {
        result: {
          ok: true,
          status: 200,
          contentType: "application/x-bittorrent",
          contentDisposition: 'attachment; filename="picked-up.torrent"',
          base64: btoa("d8:announce20:http://bt/announcee"),
        },
      },
    ]);
  }

  it("fetches through the tab the download came from, not from the worker", async () => {
    seedOpenTab(TOPIC_URL, 77);
    pageReturnsTorrent();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const downloads = getChromeDownloadsMock();

    await handleDownloadCreated(
      createDownloadItem({ id: 60, url: GUARDED_URL, finalUrl: GUARDED_URL, referrer: TOPIC_URL }),
    );

    const injection = getChromeScriptingMock().executeScript.mock.calls[0]?.[0] as {
      target: { tabId: number };
      args: string[];
      world: string;
    };
    expect(injection.target.tabId).toBe(77);
    expect(injection.args).toEqual([GUARDED_URL]);
    // MAIN world, so the request carries the page's own origin rather than an isolated one.
    expect(injection.world).toBe("MAIN");

    // The worker must not have fetched the tracker itself — that is the request that gets a 403.
    expect(fetchSpy.mock.calls.map((call) => String(call[0]))).not.toContain(GUARDED_URL);
    expect(downloads.cancel).toHaveBeenCalledWith(60);
  });

  it("prefers the tab the download started from over another tab on the site", async () => {
    getChromeTabsMock().query.mockResolvedValue([
      { id: 1, url: OTHER_TOPIC } as chrome.tabs.Tab,
      { id: 2, url: TOPIC_URL } as chrome.tabs.Tab,
    ]);
    pageReturnsTorrent();

    await handleDownloadCreated(
      createDownloadItem({ id: 61, url: GUARDED_URL, finalUrl: GUARDED_URL, referrer: TOPIC_URL }),
    );

    const injection = getChromeScriptingMock().executeScript.mock.calls[0]?.[0] as {
      target: { tabId: number };
    };
    expect(injection.target.tabId).toBe(2);
  });

  it("takes the file name the page reported in Content-Disposition", async () => {
    seedOpenTab(TOPIC_URL);
    pageReturnsTorrent();
    const notifications = getChromeNotificationsMock();

    await handleDownloadCreated(
      createDownloadItem({ id: 62, url: GUARDED_URL, finalUrl: GUARDED_URL, referrer: TOPIC_URL }),
    );

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("picked-up.torrent") }),
    );
  });

  it("falls back to the worker's own fetch when the site is not open in any tab", async () => {
    const nas = mockSuccessfulHandoff();

    await handleDownloadCreated(createDownloadItem({ id: 63 }));

    expect(getChromeScriptingMock().executeScript).not.toHaveBeenCalled();
    expect(nas.addTorrentCalls).toBe(1);
  });

  it("explains a refusal instead of reporting a bare HTTP status", async () => {
    seedOpenTab(TOPIC_URL);
    getChromeScriptingMock().executeScript.mockResolvedValue([
      {
        result: {
          ok: false,
          status: 403,
          contentType: "text/html",
          contentDisposition: "",
          base64: "",
        },
      },
    ]);
    const notifications = getChromeNotificationsMock();

    await handleDownloadCreated(
      createDownloadItem({ id: 64, url: GUARDED_URL, finalUrl: GUARDED_URL, referrer: TOPIC_URL }),
    );

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("logged in") }),
    );
  });
});

/**
 * The claim marker lives in session storage and so outlives the worker, while the in-memory
 * half of the guard does not. Left behind after a failure it would silently bar every retry —
 * a download that is never intercepted and never explains why.
 */
describe("download interception — claim lifecycle", () => {
  beforeEach(() => {
    seedChromeStorage(createTestSettings());
  });

  it("releases the claim when the hand-off throws, so a later event can retry", async () => {
    server.use(
      http.get(TORRENT_URL, () => {
        throw new Error("network down");
      }),
    );

    await handleDownloadCreated(createDownloadItem({ id: 9 }));

    expect(getChromeSessionStorageSnapshot()["qg-claimed-9"]).toBeUndefined();
  });

  it("keeps the claim while the hand-off succeeds, so both listeners cannot send it twice", async () => {
    const nas = mockSuccessfulHandoff();

    await handleDownloadCreated(createDownloadItem({ id: 10 }));
    await handleDownloadCreated(createDownloadItem({ id: 10 }));

    expect(nas.addTorrentCalls).toBe(1);
    expect(getChromeSessionStorageSnapshot()["qg-claimed-10"]).toBe(true);
  });

  it("drops claims left by a dead worker on the next start", async () => {
    seedChromeSessionStorage({ "qg-claimed-11": true, "qg-claimed-12": true, sessionNASpassword: "secret" });

    await recoverAbandonedHandoffs();

    const snapshot = getChromeSessionStorageSnapshot();
    expect(snapshot["qg-claimed-11"]).toBeUndefined();
    expect(snapshot["qg-claimed-12"]).toBeUndefined();
    // Unrelated session state must survive the sweep.
    expect(snapshot.sessionNASpassword).toBe("secret");
  });
});
