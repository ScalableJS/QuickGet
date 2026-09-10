import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { createTestSettings } from "../../tests/fixtures/settings.js";
import { server } from "../../tests/msw/server.js";
import { sendTorrentUrlToNas } from "./torrentSender.js";

const VALID_BENCODED_TORRENT = "d8:announce20:http://bt/announcee";

describe("sendTorrentUrlToNas — Content-Disposition & RFC 5987 / 6266 filename resolution", () => {
  const TORRENT_ENDPOINT = "https://tracker.example.com/download-endpoint";

  beforeEach(() => {
    // NAS endpoints
    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", () => HttpResponse.json({ error: 0 })),
    );
  });

  it.each([
    [
      "attachment; filename*=UTF-8''%D0%A4%D0%B8%D0%BB%D1%8C%D0%BC.torrent",
      "Фильм.torrent",
      "RFC 5987 UTF-8 without language tag",
    ],
    [
      "attachment; filename*=UTF-8'en'%D1%82%D0%B5%D1%81%D1%82.torrent",
      "тест.torrent",
      "RFC 5987 UTF-8 with language tag",
    ],
    ["attachment; filename*=iso-8859-1'en'%A3%20rates.torrent", "£ rates.torrent", "RFC 5987 ISO-8859-1 encoding"],
    [
      "attachment; filename=\"fallback.torrent\"; filename*=UTF-8''%D0%9E%D1%81%D0%BE%D0%B1%D1%8B%D0%B9.torrent",
      "Особый.torrent",
      "RFC 6266 precedence: filename* over fallback filename",
    ],
    [
      "attachment; filename*=UTF-8''%D0%9E%D1%81%D0%BE%D0%B1%D1%8B%D0%B9.torrent; filename=\"fallback.torrent\"",
      "Особый.torrent",
      "RFC 6266 precedence: filename* first in header",
    ],
    [
      'inline; filename="TorrentPier_release.torrent"',
      "TorrentPier_release.torrent",
      "TorrentPier inline Content-Disposition shape",
    ],
    ["attachment; filename='single-quoted.torrent'", "single-quoted.torrent", "single-quoted filename parameter"],
    [
      'attachment; filename="[Tracker] Album (FLAC) 2026.torrent"',
      "[Tracker] Album (FLAC) 2026.torrent",
      "quoted filename with spaces and punctuation",
    ],
    ["attachment; filename=archlinux-2026.torrent; size=1024", "archlinux-2026.torrent", "unquoted filename parameter"],
    ['attachment; filename="../../evil.torrent"', "evil.torrent", "strips directory traversal path from header"],
  ])("resolves Content-Disposition %s to %s (%s)", async (contentDisposition, expectedName) => {
    server.use(
      http.get(TORRENT_ENDPOINT, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode(VALID_BENCODED_TORRENT).buffer as ArrayBuffer, {
          headers: {
            "content-type": "application/x-bittorrent",
            "content-disposition": contentDisposition,
          },
        }),
      ),
    );

    const result = await sendTorrentUrlToNas(createTestSettings(), TORRENT_ENDPOINT);
    expect(result.name).toBe(expectedName);
    expect(result.duplicate).toBe(false);
  });

  it("falls back to URL pathname when Content-Disposition is absent", async () => {
    const url = "https://tracker.example.com/torrents/debian-netinst.torrent";
    server.use(
      http.get(url, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode(VALID_BENCODED_TORRENT).buffer as ArrayBuffer, {
          headers: { "content-type": "application/x-bittorrent" },
        }),
      ),
    );

    const result = await sendTorrentUrlToNas(createTestSettings(), url);
    expect(result.name).toBe("debian-netinst.torrent");
  });

  it("decodes percent-encoded URL pathname fallback", async () => {
    const url = "https://tracker.example.com/torrents/%D0%94%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82.torrent";
    server.use(
      http.get(url, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode(VALID_BENCODED_TORRENT).buffer as ArrayBuffer, {
          headers: { "content-type": "application/x-bittorrent" },
        }),
      ),
    );

    const result = await sendTorrentUrlToNas(createTestSettings(), url);
    expect(result.name).toBe("Документ.torrent");
  });

  it("defaults to download.torrent when both Content-Disposition and URL have no torrent name", async () => {
    server.use(
      http.get(TORRENT_ENDPOINT, () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode(VALID_BENCODED_TORRENT).buffer as ArrayBuffer, {
          headers: { "content-type": "application/x-bittorrent" },
        }),
      ),
    );

    const result = await sendTorrentUrlToNas(createTestSettings(), TORRENT_ENDPOINT);
    expect(result.name).toBe("download.torrent");
  });
});
