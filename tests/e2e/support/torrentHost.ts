import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";

export interface TorrentHostHandle {
  /** URL Chrome should navigate to in order to start a real `.torrent` download. */
  url: string;
  /** How many times the browser (or the extension) fetched the file. */
  requestCount: () => number;
  close: () => Promise<void>;
}

/**
 * Serves one `.torrent` as a genuine attachment so Chrome starts a real download rather
 * than rendering it. Needed because `chrome.downloads.onCreated` only fires for downloads
 * the browser itself initiated.
 */
export async function startTorrentHost(
  fixturePath: string,
  options: { bodyDelayMs?: number } = {},
): Promise<TorrentHostHandle> {
  const body = await readFile(fixturePath);
  let requests = 0;

  const server: Server = createServer((_request, response) => {
    requests += 1;
    response.writeHead(200, {
      "content-type": "application/x-bittorrent",
      "content-disposition": 'attachment; filename="sample.torrent"',
      "content-length": String(body.byteLength),
    });

    // Headers first, body later: without a delay a small .torrent from localhost completes
    // before the extension can pause it, so the transaction under test never happens.
    const delay = options.bodyDelayMs ?? 0;
    if (delay === 0) {
      response.end(body);
      return;
    }
    setTimeout(() => response.end(body), delay);
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (typeof address === "string" || address === null) {
    throw new Error("Failed to determine torrent host port");
  }

  return {
    url: `http://127.0.0.1:${address.port}/sample.torrent`,
    requestCount: () => requests,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
