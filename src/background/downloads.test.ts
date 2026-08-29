import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestSettings } from "../../tests/fixtures/settings.js";
import {
  createDownloadItem,
  getChromeDownloadsMock,
  getChromeNotificationsMock,
  getChromeSessionStorageSnapshot,
  getChromeActionMock,
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

import { markConfigurationProblem } from "./actions.js";
import { handleDownloadCreated, recoverAbandonedHandoffs } from "./downloads.js";

const TORRENT_URL = "https://tracker.example.com/file.torrent";
const ACTIVE_ICON = { 32: "icons/32_active.png", 128: "icons/128_active.png" };

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

  it("continues the NAS hand-off when Chrome cannot repaint the action icon", async () => {
    seedChromeStorage(createTestSettings());
    const nas = mockSuccessfulHandoff();
    getChromeActionMock().setIcon.mockRejectedValueOnce(new Error("action unavailable"));

    await handleDownloadCreated(createDownloadItem());

    expect(nas.addTorrentCalls).toBe(1);
    expect(downloads.cancel).toHaveBeenCalledWith(1);
  });

  it("does not let an older working-state write erase a newer parallel failure", async () => {
    seedChromeStorage(createTestSettings());
    mockSuccessfulHandoff();

    let releaseRepaint!: () => void;
    let signalRepaintReached!: () => void;
    const repaintGate = new Promise<void>((resolve) => {
      releaseRepaint = resolve;
    });
    const repaintReached = new Promise<void>((resolve) => {
      signalRepaintReached = resolve;
    });
    getChromeActionMock().setIcon.mockImplementationOnce(async () => {
      signalRepaintReached();
      await repaintGate;
    });

    const olderSuccess = handleDownloadCreated(createDownloadItem());
    await repaintReached;
    const newerFailure = markConfigurationProblem("parallel AddTorrent failed");
    // Let an implementation without serialization read and write its stale snapshot. A
    // serialized implementation correctly waits behind the gated working transition.
    await Promise.resolve();
    await Promise.resolve();
    releaseRepaint();
    await Promise.all([newerFailure, olderSuccess]);

    expect(getChromeSessionStorageSnapshot()["qg:toolbarState"]).toEqual(
      expect.objectContaining({ badgeText: "!", failureRevision: 1 }),
    );
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
    // The password lives in storage.session while an unsaved edit is in flight; local has none.
    seedChromeStorage(createTestSettings({ NASpassword: "" }));
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
      http.get(url, () => HttpResponse.arrayBuffer(new TextEncoder().encode("d8:announce…e").buffer as ArrayBuffer)),
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", () => HttpResponse.json({ error: 0 })),
    );

    await handleDownloadCreated(createDownloadItem({ url, finalUrl: url, mime: "application/octet-stream" }));

    expect(downloads.cancel).toHaveBeenCalledWith(1);
  });

  it("recognises a torrent by filename when the URL and MIME say nothing", async () => {
    seedChromeStorage(createTestSettings());
    const url = "https://tracker.example.com/download?id=1234";
    server.use(
      http.get(url, () => HttpResponse.arrayBuffer(new TextEncoder().encode("d8:announce…e").buffer as ArrayBuffer)),
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", () => HttpResponse.json({ error: 0 })),
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

  it("keeps the first listener's in-flight ownership while duplicate listeners return", async () => {
    // A must wait before it persists the durable claim. B sees A's synchronous in-memory
    // claim and returns. C then proves whether B incorrectly released A's ownership in its
    // outer finally: only A is allowed to make the NAS hand-off.
    seedChromeStorage(createTestSettings());
    const nas = mockSuccessfulHandoff();
    const item = createDownloadItem({ id: 87 });

    let releaseClaimWrite!: () => void;
    let signalClaimWriteReached!: () => void;
    const claimWriteGate = new Promise<void>((resolve) => {
      releaseClaimWrite = resolve;
    });
    const claimWriteReached = new Promise<void>((resolve) => {
      signalClaimWriteReached = resolve;
    });
    const sessionSet = vi.mocked(chrome.storage.session.set);
    const originalSessionSet = sessionSet.getMockImplementation();
    sessionSet.mockImplementationOnce(async (items, callback) => {
      if (Object.getOwnPropertyDescriptor(items, "qg-claimed-87")?.value === true) {
        signalClaimWriteReached();
        await claimWriteGate;
      }
      originalSessionSet?.(items, callback);
    });

    const first = handleDownloadCreated(item);
    await claimWriteReached;
    await handleDownloadCreated(item);
    const third = handleDownloadCreated(item);

    // Keep A's claim write blocked through one event-loop turn. The broken ownership release
    // lets C reach the NAS in that window; a correct one leaves C rejected by A's in-flight
    // guard without needing timing assumptions about the NAS mock.
    await new Promise((resolve) => setTimeout(resolve));

    releaseClaimWrite();
    await Promise.all([first, third]);

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

  it("records recovery intent before pausing the browser download", async () => {
    seedChromeStorage(createTestSettings());
    mockSuccessfulHandoff();

    await handleDownloadCreated(createDownloadItem({ id: 88 }));

    const pendingWrite = vi
      .mocked(chrome.storage.session.set)
      .mock.calls.findIndex(([items]) => Object.getOwnPropertyDescriptor(items, "qg-pending-88")?.value === true);
    expect(pendingWrite).toBeGreaterThanOrEqual(0);
    const pendingWriteOrder = vi.mocked(chrome.storage.session.set).mock.invocationCallOrder[pendingWrite];
    const pauseOrder = downloads.pause.mock.invocationCallOrder[0];
    expect(pendingWriteOrder).toBeLessThan(pauseOrder);
  });

  it("removes recovery intent when Chrome cannot pause the browser download", async () => {
    seedChromeStorage(createTestSettings());
    mockSuccessfulHandoff();
    downloads.pause.mockRejectedValueOnce(new Error("download already complete"));

    await handleDownloadCreated(createDownloadItem({ id: 89 }));

    expect(getChromeSessionStorageSnapshot()["qg-pending-89"]).toBeUndefined();
    expect(chrome.storage.session.remove).toHaveBeenCalledWith("qg-pending-89");
  });

  it("leaves the download alone when the NAS address is not configured", async () => {
    seedChromeStorage(createTestSettings({ NASaddress: "" }));

    await handleDownloadCreated(createDownloadItem());

    expect(downloads.pause).not.toHaveBeenCalled();
    expect(downloads.cancel).not.toHaveBeenCalled();
  });

  it("sends the torrent even though a settings password is set", async () => {
    // The settings lock guards the settings screen, never the hand-off. A download starts when
    // the user clicks a link, not when they open the popup — gating it here is what silently
    // dropped every torrent after a browser restart.
    seedChromeStorage({
      ...createTestSettings(),
      settingsLockEnabled: true,
      settingsLockVerifier: "irrelevant",
    });
    const nas = mockSuccessfulHandoff();

    await handleDownloadCreated(createDownloadItem());

    expect(nas.addTorrentCalls).toBe(1);
    expect(downloads.cancel).toHaveBeenCalled();
  });

  it("never touches the download when the session password was cleared by a restart", async () => {
    // The password lives only in storage.session, which a browser
    // restart empties. isLocked() reports false here, so it alone is not a sufficient guard.
    seedChromeStorage(createTestSettings({ NASpassword: "", torrentInterceptMode: "always" }));

    await handleDownloadCreated(createDownloadItem());

    expect(downloads.cancel).not.toHaveBeenCalled();
    expect(downloads.pause).not.toHaveBeenCalled();
  });
});

describe("download interception — toolbar lifecycle", () => {
  beforeEach(() => {
    seedChromeStorage(createTestSettings());
  });

  it("shows the green active icon while the accepted interception is still in flight", async () => {
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

    const handOff = handleDownloadCreated(createDownloadItem({ id: 90 }));
    await addTorrentReached;

    const action = getChromeActionMock();
    expect(action.setIcon).toHaveBeenCalledWith({ path: ACTIVE_ICON });
    expect(action.setTitle).toHaveBeenCalledWith({ title: "Sending torrent to QNAP…" });

    releaseAddTorrent();
    await handOff;
  });

  it("repaints green even when the persisted cache already says active", async () => {
    seedChromeSessionStorage({
      "qg:toolbarState": {
        badgeText: "",
        icon: "active",
        colorSet: false,
        title: "",
        failureRevision: 0,
        zeroStreak: 0,
        errorStreak: 0,
      },
    });
    mockSuccessfulHandoff();
    const action = getChromeActionMock();

    await handleDownloadCreated(createDownloadItem({ id: 93 }));

    expect(action.setIcon).toHaveBeenCalledWith({ path: ACTIVE_ICON });
  });

  it("keeps a parallel failure red when an earlier successful hand-off completes afterwards", async () => {
    let requestCount = 0;
    let releaseFirstAddTorrent!: () => void;
    let signalFirstAddTorrentReached!: () => void;
    const firstAddTorrentGate = new Promise<void>((resolve) => {
      releaseFirstAddTorrent = resolve;
    });
    const firstAddTorrentReached = new Promise<void>((resolve) => {
      signalFirstAddTorrentReached = resolve;
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
        requestCount += 1;
        if (requestCount === 1) {
          signalFirstAddTorrentReached();
          await firstAddTorrentGate;
          return HttpResponse.json({ error: 0 });
        }
        return HttpResponse.json({ error: 4096, reason: "temp" });
      }),
    );

    const earlierSuccess = handleDownloadCreated(createDownloadItem({ id: 91 }));
    await firstAddTorrentReached;
    await handleDownloadCreated(createDownloadItem({ id: 92 }));

    const action = getChromeActionMock();
    expect(action.setBadgeText).toHaveBeenLastCalledWith({ text: "!" });
    expect(action.setBadgeBackgroundColor).toHaveBeenLastCalledWith({ color: "#D93025" });

    releaseFirstAddTorrent();
    await earlierSuccess;

    expect(action.setBadgeText).toHaveBeenLastCalledWith({ text: "!" });
    expect(action.setBadgeBackgroundColor).toHaveBeenLastCalledWith({ color: "#D93025" });
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
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", () => HttpResponse.json({ error: 0 })),
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

/**
 * A misconfiguration produces no downloads, so no poll runs and no badge changes — the user
 * finds out only when a torrent quietly fails. The toolbar is the one place a fault can be
 * shown without opening anything, which is why it is asserted rather than left to the log.
 */
describe("download interception — configuration is visible", () => {
  it("marks the toolbar and names the missing setting instead of failing on an API field", async () => {
    seedChromeStorage(createTestSettings({ NASlogin: "" }));
    const action = getChromeActionMock();
    const notifications = getChromeNotificationsMock();
    const downloads = getChromeDownloadsMock();

    await handleDownloadCreated(createDownloadItem({ id: 70 }));

    expect(action.setBadgeText).toHaveBeenCalledWith({ text: "!" });
    expect(action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#D93025" });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Username") }),
    );
    // The browser keeps the file: a configuration fault must never cost the download.
    expect(downloads.cancel).not.toHaveBeenCalled();
    expect(downloads.pause).not.toHaveBeenCalled();
  });

  it("lists every missing setting at once rather than one per attempt", async () => {
    seedChromeStorage(createTestSettings({ NASpassword: "", NASlogin: "" }));
    const notifications = getChromeNotificationsMock();

    await handleDownloadCreated(createDownloadItem({ id: 71 }));

    const message = notifications.create.mock.calls[0]?.[0]?.message as string;
    expect(message).toContain("Username");
    expect(message).toContain("Password");
  });

  it("reports a missing password as plain misconfiguration, with nothing to unlock", async () => {
    seedChromeStorage({
      ...createTestSettings({ NASpassword: "" }),
      // A leftover blob from the encrypted scheme must not resurrect a locked state.
      encryptedNASpassword: { iv: "x", salt: "y", data: "z" },
    });
    const notifications = getChromeNotificationsMock();

    await handleDownloadCreated(createDownloadItem({ id: 72 }));

    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ title: "QuickGet is not configured" }));
    const message = notifications.create.mock.calls[0]?.[0]?.message as string;
    expect(message).toContain("Password");
  });

  it("marks the toolbar when the hand-off itself fails", async () => {
    seedChromeStorage(createTestSettings());
    mockFailedHandoff();
    const action = getChromeActionMock();

    await handleDownloadCreated(createDownloadItem({ id: 73 }));

    expect(action.setBadgeText).toHaveBeenCalledWith({ text: "!" });
  });

  it("keeps the fault until the user opens the popup even after a later hand-off succeeds", async () => {
    seedChromeStorage(createTestSettings());
    seedChromeSessionStorage({ "qg:toolbarState": { badgeText: "!", title: "old", colorSet: false } });
    mockSuccessfulHandoff();
    const action = getChromeActionMock();

    await handleDownloadCreated(createDownloadItem({ id: 74 }));

    expect(action.setBadgeText).not.toHaveBeenCalledWith({ text: "" });
  });
});

/**
 * A toast is not a log. It is worth interrupting for only when the user must act — which a
 * successful send never is. Reporting every outcome is what buried the messages that mattered.
 */
describe("download interception — notification restraint", () => {
  beforeEach(() => {
    seedChromeStorage(createTestSettings());
  });

  it("says nothing at all when the torrent goes through", async () => {
    const notifications = getChromeNotificationsMock();
    mockSuccessfulHandoff();

    await handleDownloadCreated(createDownloadItem({ id: 80 }));

    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("reports a failure once, not once per attempt", async () => {
    const notifications = getChromeNotificationsMock();
    mockFailedHandoff();

    await handleDownloadCreated(createDownloadItem({ id: 81 }));
    await handleDownloadCreated(createDownloadItem({ id: 82 }));
    await handleDownloadCreated(createDownloadItem({ id: 83 }));

    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it("speaks up again after things worked in between", async () => {
    const notifications = getChromeNotificationsMock();

    mockFailedHandoff();
    await handleDownloadCreated(createDownloadItem({ id: 84 }));
    expect(notifications.create).toHaveBeenCalledTimes(1);

    mockSuccessfulHandoff();
    await handleDownloadCreated(createDownloadItem({ id: 85 }));

    mockFailedHandoff();
    await handleDownloadCreated(createDownloadItem({ id: 86 }));

    // A problem that returns after a recovery is news again.
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });

  it("does not suppress a different kind of problem behind an ongoing one", async () => {
    const notifications = getChromeNotificationsMock();

    mockFailedHandoff();
    await handleDownloadCreated(createDownloadItem({ id: 87 }));

    seedChromeStorage(createTestSettings({ NASlogin: "" }));
    await handleDownloadCreated(createDownloadItem({ id: 88 }));

    expect(notifications.create).toHaveBeenCalledTimes(2);
  });
});
