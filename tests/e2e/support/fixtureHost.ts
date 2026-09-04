import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";

export interface FixtureHostHandle {
  url: string;
  close: () => Promise<void>;
}

export async function startFixtureHost(filePath: string): Promise<FixtureHostHandle> {
  const content = await readFile(filePath);

  const server: Server = createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-length": String(content.byteLength),
    });
    response.end(content);
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (typeof address === "string" || address === null) {
    throw new Error("Failed to determine fixture host port");
  }

  return {
    url: `http://127.0.0.1:${address.port}/index.html`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
