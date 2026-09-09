import { describe, expect, it } from "vitest";

import { classifySource, isTorrentSource, magnetDisplayName } from "./sourceKind.js";

describe("isTorrentSource", () => {
  it.each([
    // Direct URL cases
    ["https://tracker.org/ubuntu.torrent", undefined, undefined, true, "direct .torrent URL"],
    ["https://tracker.org/debian.TORRENT", undefined, undefined, true, "case-insensitive extension"],
    ["https://tracker.org/file.torrent?key=secret&id=1", undefined, undefined, true, "URL with query string"],
    ["https://tracker.org/file.torrent#hash123", undefined, undefined, true, "URL with fragment"],
    ["https://tracker.org/file.torrent?auth=token#frag", undefined, undefined, true, "URL with query and fragment"],

    // Opaque endpoints identified by MIME
    [
      "https://tracker.org/dl.php?t=1",
      "application/x-bittorrent",
      undefined,
      true,
      "opaque endpoint with torrent MIME",
    ],
    [
      "https://tracker.org/download/42",
      "application/x-bittorrent; charset=binary",
      undefined,
      true,
      "MIME with charset parameter",
    ],
    ["https://tracker.org/action/download", "application/x-torrent", undefined, true, "alternative torrent MIME type"],

    // Opaque endpoints with application/octet-stream (TorrentPier default) identified by Chrome filename
    [
      "https://tracker.org/dl.php?t=1",
      "application/octet-stream",
      "release.torrent",
      true,
      "TorrentPier octet-stream with filename",
    ],
    [
      "https://tracker.org/post/download",
      "application/octet-stream",
      "content.TORRENT",
      true,
      "POST/opaque download with uppercase extension",
    ],
    [
      "https://tracker.org/get_file?id=99",
      "application/octet-stream",
      "/Users/user/Downloads/movie.torrent",
      true,
      "full local download path ending in .torrent",
    ],

    // Redirect / signed final URL cases
    [
      "https://s3.amazonaws.com/tracker-bucket/signed-file.torrent?AWSAccessKeyId=AKIA1234&Signature=xyz",
      undefined,
      undefined,
      true,
      "signed S3 URL ending in .torrent with query parameters",
    ],
    [
      "https://cdn.tracker.net/temp/one-time-token/file.torrent?token=abc#dl",
      undefined,
      undefined,
      true,
      "redirect/CDN signed URL with query and hash",
    ],

    // Non-torrent downloads (including dl.php without torrent indicators)
    [
      "https://example.com/dl.php?file=manual.pdf",
      "application/pdf",
      "manual.pdf",
      false,
      "dl.php serving PDF is not a torrent",
    ],
    [
      "https://tracker.org/download.php?id=500",
      "application/octet-stream",
      undefined,
      false,
      "octet-stream without .torrent filename is not assumed torrent",
    ],
    ["https://example.com/video.mp4", "video/mp4", "video.mp4", false, "ordinary video download"],
    ["https://tracker.org/topic/123", "text/html", undefined, false, "HTML topic page"],
    ["https://example.com/image.png", "image/png", undefined, false, "PNG image"],

    // Magnet links invariant: magnets are handled by classifyUrl/AddUrl and not intercepted as binary downloads
    [
      "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Ubuntu",
      undefined,
      undefined,
      false,
      "magnet URI is not a binary torrent download source",
    ],
  ])("evaluates %s (%s, %s) -> %s (%s)", (url, mime, filename, expected, _description) => {
    expect(isTorrentSource(url, { mime, filename })).toBe(expected);
  });
});

describe("classifySource — URL alone", () => {
  it.each([
    ["magnet:?xt=urn:btih:abc", "magnet"],
    ["MAGNET:?xt=urn:btih:abc", "magnet"],
    ["https://site.com/file.torrent", "torrent"],
    ["https://site.com/file.TORRENT", "torrent"],
    ["https://site.com/file.Torrent", "torrent"],
    ["https://site.com/file.torrent?x=1", "torrent"],
    ["https://site.com/video.mkv", "url"],
    ["http://site.com/", "url"],
  ] as const)("classifies %s as %s", (url, expected) => {
    expect(classifySource(url)).toBe(expected);
  });
});

/**
 * The routing kind and the transport choice must come from the same place. When they did not,
 * a tracker's `dl.php` link was uploaded as a torrent and routed as a plain URL at once, so a
 * rule written for `.torrent` never fired on the links it exists for.
 */
describe("classifySource", () => {
  it("agrees with isTorrentSource on every signal it accepts", () => {
    const cases: [string, string | undefined, string | undefined][] = [
      ["https://tracker.example.com/dl.php?id=12345", undefined, undefined],
      ["https://files.example.com/ubuntu.torrent", undefined, undefined],
      ["https://files.example.com/GET?x=1", "application/x-bittorrent", undefined],
      ["https://files.example.com/GET?x=1", undefined, "Some.Release.torrent"],
      ["https://files.example.com/notes.pdf", "application/pdf", "notes.pdf"],
      ["https://files.example.com/video.mkv", undefined, undefined],
    ];

    for (const [url, mime, filename] of cases) {
      const expected = isTorrentSource(url, { mime, filename }) ? "torrent" : "url";
      expect(classifySource(url, { mime, filename }), url).toBe(expected);
    }
  });

  it("classifies a tracker endpoint with no extension as a torrent", () => {
    expect(classifySource("https://tracker.example.com/dl.php?id=12345")).toBe("torrent");
  });

  it("keeps magnets out of the torrent branch, whatever the rest of the URI looks like", () => {
    expect(classifySource("magnet:?xt=urn:btih:abc&dn=Some.Release")).toBe("magnet");
    expect(classifySource("MAGNET:?xt=urn:btih:abc&tr=https://t/dl.php")).toBe("magnet");
  });

  it("leaves an ordinary download alone", () => {
    expect(classifySource("https://files.example.com/ubuntu.iso")).toBe("url");
  });
});

describe("magnetDisplayName", () => {
  it("reads the display name", () => {
    expect(magnetDisplayName("magnet:?xt=urn:btih:abc&dn=Some.Release.2024.mkv")).toBe("Some.Release.2024.mkv");
  });

  it("keeps a name containing '=' whole", () => {
    expect(magnetDisplayName("magnet:?xt=urn:btih:abc&dn=Release_Name=Director_Cut=2024.mkv")).toBe(
      "Release_Name=Director_Cut=2024.mkv",
    );
  });

  it("survives a malformed percent escape rather than throwing", () => {
    expect(magnetDisplayName("magnet:?xt=urn:btih:abc&dn=broken%ZZtitle.mkv")).toBe("broken%ZZtitle.mkv");
  });

  it("reports absence rather than an empty string, because the two mean different things", () => {
    expect(magnetDisplayName("magnet:?xt=urn:btih:abc")).toBeUndefined();
    expect(magnetDisplayName("magnet:?xt=urn:btih:abc&dn=%20%20")).toBeUndefined();
    expect(magnetDisplayName("magnet:")).toBeUndefined();
  });
});
