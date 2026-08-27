import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestSettings } from "../../tests/fixtures/settings.js";
import {
  createDownloadItem,
  getChromeDownloadsMock,
  seedChromeStorage,
} from "../../tests/mocks/chrome.js";
import { server } from "../../tests/msw/server.js";

vi.mock("./alarms.js", () => ({
  ensureMonitoring: vi.fn(),
}));

import { handleDownloadCreated } from "./downloads.js";

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

describe("download interception", () => {
  let downloads: ReturnType<typeof getChromeDownloadsMock>;

  beforeEach(() => {
    downloads = getChromeDownloadsMock();
    seedChromeStorage(createTestSettings({ NASpassword: "", rememberPassword: false }));
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

    // The contract: pause happens before the hand-off, cancel strictly after it.
    const pausedAt = downloads.pause.mock.invocationCallOrder[0];
    const cancelledAt = downloads.cancel.mock.invocationCallOrder[0];
    expect(pausedAt).toBeLessThan(cancelledAt);
  });

  it("resumes the browser download when the NAS rejects the torrent", async () => {
    seedChromeStorage(createTestSettings());

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

    await handleDownloadCreated(createDownloadItem());

    expect(downloads.resume).toHaveBeenCalledWith(1);
    expect(downloads.cancel).not.toHaveBeenCalled();
  });

  it("never touches the download while the master password is locked", async () => {
    seedChromeStorage(
      createTestSettings({ NASpassword: "", rememberPassword: true, torrentInterceptMode: "always" }),
    );

    await handleDownloadCreated(createDownloadItem());

    expect(downloads.cancel).not.toHaveBeenCalled();
    expect(downloads.pause).not.toHaveBeenCalled();
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
