import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");
const standHtmlPath = path.join(fixtureDir, "test-stand/index.html");

export type TestStandHostHandle = {
  url: string;
  port: number;
  requestLog: Array<{ path: string; method: string }>;
  close: () => Promise<void>;
};

export type TestStandHostOptions = {
  port?: number;
  bodyDelayMs?: number;
};

/**
 * Serves the manual test stand, and — the part that matters for routing — serves a *different*
 * torrent per link.
 *
 * A single shared `sample.torrent` made every `.torrent` on the stand identical inside, so
 * nothing could tell whether the extension routed on the URL or on the file's real content name.
 * Here `info.name` is derived from what was requested, and the tracker-style endpoints reveal
 * that name only through `Content-Disposition` or not at all — which is the situation on a real
 * private tracker and the reason routing on the URL fails there.
 */
export async function startTestStandHost(options: TestStandHostOptions = {}): Promise<TestStandHostHandle> {
  const standHtml = await readFile(standHtmlPath);
  const requestLog: Array<{ path: string; method: string }> = [];

  const server: Server = createServer((request, response) => {
    const rawUrl = request.url ?? "/";
    let url: URL;
    try {
      url = new URL(rawUrl, "http://127.0.0.1");
    } catch {
      url = new URL("/", "http://127.0.0.1");
    }
    const pathname = url.pathname;
    requestLog.push({ path: pathname, method: request.method ?? "GET" });

    const send = (status: number, headers: Record<string, string>, payload: Buffer): void => {
      response.writeHead(status, { ...headers, "content-length": String(payload.byteLength) });
      const delay = options.bodyDelayMs ?? 0;
      if (delay === 0) response.end(payload);
      else setTimeout(() => response.end(payload), delay);
    };

    if (pathname === "/" || pathname === "/index.html") {
      send(200, { "content-type": "text/html; charset=utf-8" }, standHtml);
      return;
    }

    // A tracker's opaque download endpoint: nothing in the URL says "torrent" or names the
    // release. The MIME type and Content-Disposition are the only signals, exactly as on
    // TorrentPier-style sites.
    if (pathname === "/dl.php") {
      const name = url.searchParams.get("name") ?? "Tracker.Release.2024.1080p.mkv";
      const multi = url.searchParams.get("multi") === "1";
      send(
        200,
        {
          "content-type": "application/x-bittorrent",
          "content-disposition": `attachment; filename="${name}.torrent"`,
        },
        buildTorrent(name, multi),
      );
      return;
    }

    // The harder variant of the same thing: correct MIME, no Content-Disposition, no extension.
    // Chrome has no filename to offer, so the only name in existence is inside the file.
    if (pathname.startsWith("/get/")) {
      const name = decodeURIComponent(path.basename(pathname));
      send(200, { "content-type": "application/x-bittorrent" }, buildTorrent(name));
      return;
    }

    if (pathname.startsWith("/files/")) {
      const filename = decodeURIComponent(path.basename(pathname));
      const isTorrent = filename.toLowerCase().endsWith(".torrent");

      if (isTorrent) {
        // `Big.Buck.Bunny.mkv.torrent` describes `Big.Buck.Bunny.mkv`.
        const contentName = filename.replace(/\.torrent$/i, "");
        send(
          200,
          {
            "content-type": "application/x-bittorrent",
            "content-disposition": `attachment; filename="${filename}"`,
          },
          buildTorrent(contentName),
        );
        return;
      }

      const contentType = filename.endsWith(".mkv")
        ? "video/x-matroska"
        : filename.endsWith(".iso")
          ? "application/x-iso9660-image"
          : "application/octet-stream";
      send(
        200,
        { "content-type": contentType, "content-disposition": `attachment; filename="${filename}"` },
        Buffer.from(`DUMMY DATA FOR ${filename}\n`),
      );
      return;
    }

    send(404, { "content-type": "text/plain; charset=utf-8" }, Buffer.from("Not found"));
  });

  server.listen(options.port ?? 0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (typeof address === "string" || address === null) {
    throw new Error("Failed to determine test stand host port");
  }

  const port = address.port;
  return {
    url: `http://127.0.0.1:${port}/`,
    port,
    requestLog,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

/** A real, parseable `.torrent` whose `info.name` is the release name we want to route on. */
export function buildTorrent(contentName: string, multiFile = false): Buffer {
  const info: [string, Buffer][] = multiFile
    ? [
        [
          "files",
          blist([
            bdict([
              ["length", bint(900_000)],
              ["path", blist([bstr("Season 1"), bstr("episode-01.mkv")])],
            ]),
            bdict([
              ["length", bint(950_000)],
              ["path", blist([bstr("Season 1"), bstr("episode-02.mkv")])],
            ]),
          ]),
        ],
      ]
    : [["length", bint(1_048_576)]];

  return bdict([
    ["announce", bstr("http://127.0.0.1/announce-test")],
    ["creation date", bint(1)],
    [
      "info",
      bdict([
        ...info,
        ["name", bstr(contentName)],
        ["piece length", bint(16_384)],
        ["pieces", bstr(Buffer.alloc(20, 0xab))],
      ]),
    ],
  ]);
}

function bstr(value: string | Buffer): Buffer {
  const raw = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return Buffer.concat([Buffer.from(`${raw.length}:`), raw]);
}

function bint(value: number): Buffer {
  return Buffer.from(`i${value}e`);
}

function blist(items: Buffer[]): Buffer {
  return Buffer.concat([Buffer.from("l"), ...items, Buffer.from("e")]);
}

function bdict(entries: [string, Buffer][]): Buffer {
  return Buffer.concat([Buffer.from("d"), ...entries.flatMap(([key, value]) => [bstr(key), value]), Buffer.from("e")]);
}
