import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestSettings } from "../../tests/fixtures/settings.js";
import { seedChromeStorage } from "../../tests/mocks/chrome.js";
import { server } from "../../tests/msw/server.js";

vi.mock("./alarms.js", () => ({
  ensureMonitoring: vi.fn(),
}));

import { handleContextMenuClick } from "./menus.js";

describe("context-menu routing", () => {
  beforeEach(() => {
    seedChromeStorage(
      createTestSettings({
        NASdir: "/share/Multimedia/Default",
        routingRules: [
          { namePattern: "*.mkv", destination: "/share/Multimedia/Movies" },
          { domain: "*.example.com", destination: "/share/Multimedia/Other" },
        ],
      }),
    );
  });

  it("sends the first matching rule's folder in move and uses the default for other URLs", async () => {
    const requests: URLSearchParams[] = [];

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddUrl", async ({ request }) => {
        requests.push(new URLSearchParams(await request.text()));
        return HttpResponse.json({ error: 0 });
      }),
    );

    await handleContextMenuClick({
      editable: false,
      linkUrl: "https://downloads.example.com/movie.mkv",
      menuItemId: "quickget-send-link",
    });
    await handleContextMenuClick({
      editable: false,
      linkUrl: "https://downloads.example.org/archive.zip",
      menuItemId: "quickget-send-link",
    });

    expect(requests).toHaveLength(2);
    expect(requests[0].get("move")).toBe("Multimedia/Movies");
    expect(requests[0].get("temp")).toBe("Download");
    expect(requests[0].get("url")).toBe("https://downloads.example.com/movie.mkv");
    expect(requests[1].get("move")).toBe("Multimedia/Default");
    expect(requests[1].get("temp")).toBe("Download");
    expect(requests[1].get("url")).toBe("https://downloads.example.org/archive.zip");
  });
});

/**
 * The right-click path used to hand every link to the NAS as a bare URL. That works only for
 * sources needing no session: the NAS has no cookies on a tracker, so a login-protected
 * `dl.php`-style link answered with the login page and Download Station stored that HTML as
 * the task.
 */
describe("context-menu torrent handling", () => {
  const TRACKER_LINK = "https://tracker.example.com/forum/dl.php?t=6643908";
  const TORRENT_BYTES = new TextEncoder().encode("d8:announce30:http://bt.example/announce…e");

  beforeEach(() => {
    seedChromeStorage(createTestSettings({ NASdir: "/share/Multimedia/Default" }));
  });

  function mockNasUpload(): { addTorrent: number; addUrl: number } {
    const calls = { addTorrent: 0, addUrl: 0 };
    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", () => {
        calls.addTorrent += 1;
        return HttpResponse.json({ error: 0 });
      }),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddUrl", () => {
        calls.addUrl += 1;
        return HttpResponse.json({ error: 0 });
      }),
    );
    return calls;
  }

  it("fetches a tracker's dl.php in the browser and uploads the file, never the bare URL", async () => {
    const calls = mockNasUpload();
    let sentCredentials: RequestCredentials | undefined;

    server.use(
      http.get(TRACKER_LINK, ({ request }) => {
        sentCredentials = request.credentials;
        return HttpResponse.arrayBuffer(TORRENT_BYTES.buffer as ArrayBuffer, {
          headers: {
            "content-type": "application/x-bittorrent",
            "content-disposition": 'attachment; filename="[tracker].t6643908.torrent"',
          },
        });
      }),
    );

    await handleContextMenuClick({
      editable: false,
      linkUrl: TRACKER_LINK,
      menuItemId: "quickget-send-link",
    });

    expect(calls.addTorrent).toBe(1);
    // Handing the URL to the NAS is what produced the HTML file.
    expect(calls.addUrl).toBe(0);
    // The user's tracker session is the whole point of fetching it here.
    expect(sentCredentials).toBe("include");
  });

  it("reports a login page instead of uploading it as a torrent", async () => {
    const calls = mockNasUpload();

    server.use(
      http.get(TRACKER_LINK, () =>
        HttpResponse.html("<!doctype html><title>Login required</title>", {
          headers: { "content-type": "text/html; charset=windows-1251" },
        }),
      ),
    );

    await handleContextMenuClick({
      editable: false,
      linkUrl: TRACKER_LINK,
      menuItemId: "quickget-send-link",
    });

    expect(calls.addTorrent).toBe(0);
    expect(calls.addUrl).toBe(0);
    expect(chrome.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("log in"),
      }),
    );
  });

  it("rejects a non-torrent payload even when the tracker claims success", async () => {
    const calls = mockNasUpload();

    server.use(
      http.get(TRACKER_LINK, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode("not a torrent").buffer as ArrayBuffer, {
          headers: { "content-type": "application/octet-stream" },
        }),
      ),
    );

    await handleContextMenuClick({
      editable: false,
      linkUrl: TRACKER_LINK,
      menuItemId: "quickget-send-link",
    });

    expect(calls.addTorrent).toBe(0);
    // Nothing reaches the NAS at all — not as a file, and not as a URL it cannot fetch.
    expect(calls.addUrl).toBe(0);
    expect(chrome.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("not a .torrent") }),
    );
  });

  it("uploads a direct .torrent link as a file too", async () => {
    const calls = mockNasUpload();
    const url = "https://downloads.example.com/ubuntu.torrent";

    server.use(
      http.get(url, () =>
        HttpResponse.arrayBuffer(TORRENT_BYTES.buffer as ArrayBuffer, {
          headers: { "content-type": "application/x-bittorrent" },
        }),
      ),
    );

    await handleContextMenuClick({ editable: false, linkUrl: url, menuItemId: "quickget-send-link" });

    expect(calls.addTorrent).toBe(1);
    expect(calls.addUrl).toBe(0);
  });

  it("still sends magnets and plain URLs to the NAS as URLs", async () => {
    const calls = mockNasUpload();

    await handleContextMenuClick({
      editable: false,
      selectionText: "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567",
      menuItemId: "quickget-send-link",
    });
    await handleContextMenuClick({
      editable: false,
      linkUrl: "https://downloads.example.org/archive.zip",
      menuItemId: "quickget-send-link",
    });

    expect(calls.addUrl).toBe(2);
    expect(calls.addTorrent).toBe(0);
  });

  it("routes the fetched torrent to the folder its rule selects", async () => {
    seedChromeStorage(
      createTestSettings({
        NASdir: "/share/Multimedia/Default",
        routingRules: [{ domain: "tracker.example.com", destination: "/share/Multimedia/Films" }],
      }),
    );

    let move: string | null = null;
    server.use(
      http.get(TRACKER_LINK, () =>
        HttpResponse.arrayBuffer(TORRENT_BYTES.buffer as ArrayBuffer, {
          headers: { "content-type": "application/x-bittorrent" },
        }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", async ({ request }) => {
        const body = await request.text();
        move = /name="move"\r?\n\r?\n([^\r\n]*)/.exec(body)?.[1] ?? null;
        return HttpResponse.json({ error: 0 });
      }),
    );

    await handleContextMenuClick({
      editable: false,
      linkUrl: TRACKER_LINK,
      menuItemId: "quickget-send-link",
    });

    expect(move).toBe("Multimedia/Films");
  });
});

/**
 * Same hotlink guard as the interception path: a `dl.php` fetched without a `Referer` is
 * refused with 403 even when the session cookie is valid. The tab the link was clicked on is
 * the referrer the guard expects.
 */
describe("context-menu tracker referrer", () => {
  const GUARDED_URL = "https://tracker.example.com/forum/dl.php?t=6645249";
  const TOPIC_URL = "https://tracker.example.com/forum/viewtopic.php?t=6645249";

  beforeEach(() => {
    seedChromeStorage(createTestSettings({ NASdir: "/share/Multimedia/Default" }));
  });

  function spyOnTorrentFetch(): { init: RequestInit | undefined } {
    const captured: { init: RequestInit | undefined } = { init: undefined };
    const original = globalThis.fetch;

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (String(input) === GUARDED_URL) captured.init = init;
      return original(input as RequestInfo, init);
    });

    return captured;
  }

  it("uses the tab's URL as the referrer", async () => {
    const fetchSpy = spyOnTorrentFetch();

    server.use(
      http.get(GUARDED_URL, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode("d8:announce…e").buffer as ArrayBuffer, {
          headers: { "content-type": "application/x-bittorrent" },
        }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", () =>
        HttpResponse.json({ error: 0 }),
      ),
    );

    await handleContextMenuClick(
      { editable: false, linkUrl: GUARDED_URL, menuItemId: "quickget-send-link" },
      { url: TOPIC_URL } as chrome.tabs.Tab,
    );

    expect(fetchSpy.init?.referrer).toBe(TOPIC_URL);
    expect(fetchSpy.init?.referrerPolicy).toBe("unsafe-url");
  });

  it("tells the user to log in when the tracker answers 403", async () => {
    server.use(http.get(GUARDED_URL, () => new HttpResponse(null, { status: 403 })));

    await handleContextMenuClick({
      editable: false,
      linkUrl: GUARDED_URL,
      menuItemId: "quickget-send-link",
    });

    expect(chrome.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("logged in") }),
    );
  });
});
