import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures"
);
const standHtmlPath = path.join(fixtureDir, "test-stand/index.html");
const sampleTorrentPath = path.join(fixtureDir, "sample.torrent");

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

export async function startTestStandHost(
  options: TestStandHostOptions = {}
): Promise<TestStandHostHandle> {
  const [standHtml, sampleTorrent] = await Promise.all([
    readFile(standHtmlPath),
    readFile(sampleTorrentPath),
  ]);

  const requestLog: Array<{ path: string; method: string }> = [];

  const server: Server = createServer((request, response) => {
    const rawUrl = request.url ?? "/";
    let pathname = "/";
    try {
      pathname = new URL(rawUrl, "http://127.0.0.1").pathname;
    } catch {
      pathname = rawUrl.split("?")[0] || "/";
    }

    requestLog.push({ path: pathname, method: request.method ?? "GET" });

    if (pathname === "/" || pathname === "/index.html") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-length": String(standHtml.byteLength),
      });
      response.end(standHtml);
      return;
    }

    // Serve mock files under /files/
    if (pathname.startsWith("/files/")) {
      const filename = path.basename(pathname);
      const isTorrent =
        filename.toLowerCase().endsWith(".torrent");

      const contentType = isTorrent
        ? "application/x-bittorrent"
        : filename.endsWith(".mkv")
          ? "video/x-matroska"
          : filename.endsWith(".iso")
            ? "application/x-iso9660-image"
            : "application/octet-stream";

      const payload = isTorrent
        ? sampleTorrent
        : Buffer.from(`DUMMY DATA FOR ${filename}\n`);

      response.writeHead(200, {
        "content-type": contentType,
        "content-disposition": `attachment; filename="${filename}"`,
        "content-length": String(payload.byteLength),
      });

      const delay = options.bodyDelayMs ?? 0;
      if (delay === 0) {
        response.end(payload);
        return;
      }
      setTimeout(() => response.end(payload), delay);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  const requestedPort = options.port ?? 0;
  server.listen(requestedPort, "127.0.0.1");
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
