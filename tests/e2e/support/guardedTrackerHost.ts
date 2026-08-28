import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";

export interface GuardedRequest {
  path: string;
  referer: string | null;
  origin: string | null;
  secFetchSite: string | null;
  refused: boolean;
}

export interface GuardedTrackerHandle {
  /** A topic page carrying a link to the guarded endpoint, as a real tracker would. */
  topicUrl: string;
  /** The guarded download endpoint itself. */
  downloadUrl: string;
  /** Every request the guard saw, in order. */
  requests: GuardedRequest[];
  close: () => Promise<void>;
}

/**
 * A tracker that refuses hotlinked downloads, which is the behaviour the page-context fetch
 * exists to satisfy. The rule mirrors what real trackers check: the request must carry a
 * `Referer` from this host, and must not come from another origin.
 *
 * This is what makes the test meaningful in a way a unit test cannot be — the headers are the
 * ones Chrome actually attaches, so it fails if the fetch is issued anywhere but the page.
 */
export async function startGuardedTrackerHost(fixturePath: string): Promise<GuardedTrackerHandle> {
  const torrent = await readFile(fixturePath);
  const requests: GuardedRequest[] = [];
  let selfUrl = "";

  const server: Server = createServer((request, response) => {
    const path = request.url ?? "/";

    if (path.startsWith("/topic")) {
      const body = `<!doctype html><meta charset="utf-8"><title>Topic</title>
        <a class="dl-link" href="/dl.php?t=1">Download .torrent</a>`;
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(body);
      return;
    }

    if (!path.startsWith("/dl.php")) {
      response.writeHead(404).end();
      return;
    }

    const seen = describeRequest(path, request);
    const refused = !isFromOurPages(seen, selfUrl);
    requests.push({ ...seen, refused });

    if (refused) {
      response.writeHead(403, { "content-type": "text/html" });
      response.end("<html><body>Hotlinking is not allowed</body></html>");
      return;
    }

    response.writeHead(200, {
      "content-type": "application/x-bittorrent",
      "content-disposition": 'attachment; filename="guarded.torrent"',
      "content-length": String(torrent.byteLength),
    });
    response.end(torrent);
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (typeof address === "string" || address === null) {
    throw new Error("Failed to determine guarded tracker port");
  }

  selfUrl = `http://127.0.0.1:${address.port}`;

  return {
    topicUrl: `${selfUrl}/topic`,
    downloadUrl: `${selfUrl}/dl.php?t=1`,
    requests,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function describeRequest(path: string, request: IncomingMessage): Omit<GuardedRequest, "refused"> {
  return {
    path,
    referer: header(request, "referer"),
    origin: header(request, "origin"),
    secFetchSite: header(request, "sec-fetch-site"),
  };
}

function header(request: IncomingMessage, name: string): string | null {
  const value = request.headers[name];
  return typeof value === "string" ? value : null;
}

/** A request the tracker accepts: referred from one of its own pages, not from another origin. */
function isFromOurPages(seen: Omit<GuardedRequest, "refused">, selfUrl: string): boolean {
  if (!seen.referer?.startsWith(selfUrl)) return false;
  if (seen.origin && seen.origin !== selfUrl) return false;
  return true;
}
