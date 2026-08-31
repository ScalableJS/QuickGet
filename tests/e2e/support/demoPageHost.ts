import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/demo-page");

/** Matches the `href` in `fixtures/demo-page/index.html`; the two must stay in step. */
export const TORRENT_FILENAME = "debian-13.6.0-amd64-netinst.iso.torrent";

export interface DemoPageHostHandle {
  /** The catalogue page the demo navigates to. */
  url: string;
  /** How many times the `.torrent` itself was fetched. */
  torrentRequestCount: () => number;
  close: () => Promise<void>;
}

/**
 * Serves the "Open Downloads" demo page, its stylesheet, and the Debian `.torrent`.
 *
 * `startTorrentHost` answers every path with a single attachment, which cannot serve a page
 * the demo has to navigate to first. Here the page and the stylesheet render normally while
 * the `.torrent` is sent with `content-disposition: attachment`, so clicking the link makes
 * Chrome start a genuine download and `chrome.downloads.onCreated` fires for real.
 */
export async function startDemoPageHost(options: { bodyDelayMs?: number } = {}): Promise<DemoPageHostHandle> {
  const [page, stylesheet, torrent] = await Promise.all([
    readFile(path.join(fixtureDir, "index.html")),
    readFile(path.join(fixtureDir, "simple.min.css")),
    readFile(path.join(fixtureDir, TORRENT_FILENAME)),
  ]);

  let torrentRequests = 0;

  const server: Server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

    if (pathname === "/" || pathname === "/index.html") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-length": String(page.byteLength),
      });
      response.end(page);
      return;
    }

    if (pathname === "/simple.min.css") {
      response.writeHead(200, {
        "content-type": "text/css; charset=utf-8",
        "content-length": String(stylesheet.byteLength),
      });
      response.end(stylesheet);
      return;
    }

    if (pathname === `/${TORRENT_FILENAME}`) {
      torrentRequests += 1;
      response.writeHead(200, {
        "content-type": "application/x-bittorrent",
        "content-disposition": `attachment; filename="${TORRENT_FILENAME}"`,
        "content-length": String(torrent.byteLength),
      });

      // Same reason as `startTorrentHost`: headers first, body after a beat. A 60 KB file from
      // localhost otherwise completes before the extension can act, so the hand-off under test
      // never happens.
      const delay = options.bodyDelayMs ?? 0;
      if (delay === 0) {
        response.end(torrent);
        return;
      }
      setTimeout(() => response.end(torrent), delay);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (typeof address === "string" || address === null) {
    throw new Error("Failed to determine demo page host port");
  }

  return {
    url: `http://127.0.0.1:${address.port}/`,
    torrentRequestCount: () => torrentRequests,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
