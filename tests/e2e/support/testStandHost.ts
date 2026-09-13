import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { type ServerType, serve } from "@hono/node-server";

import { createTestStandApp, type RequestLogEntry } from "./testStand/app.js";
import { Barriers } from "./testStand/barriers.js";
import type { TransferShape } from "./testStand/transfer.js";

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");
const standHtmlPath = path.join(fixtureDir, "test-stand/index.html");

export type { RequestLogEntry } from "./testStand/app.js";
export { buildTorrent } from "./testStand/torrent.js";

export type TestStandHostHandle = {
  url: string;
  port: number;
  requestLog: RequestLogEntry[];
  /** Wait for a transfer to reach `?barrier=<name>`, and let it continue. See `Barriers`. */
  barriers: Barriers;
  close: () => Promise<void>;
};

export type TestStandHostOptions = {
  port?: number;
  /** Default delivery for file routes whose URL asks for no shape of its own. */
  shape?: TransferShape;
  /**
   * Interface to bind. Defaults to loopback, which is right for the automated suite.
   *
   * Manual testing against a **real** NAS needs `0.0.0.0`: the NAS fetches the URL itself, so
   * `http://127.0.0.1:3300/...` points at the NAS's own loopback and Download Station answers
   * `{"error":12288}` — "does not support this URL". Verified against hardware; it is why a
   * hand-test through the stand appeared to prove the extension broken when it was not.
   */
  host?: string;
};

/**
 * Serve the manual test stand and its fixtures.
 *
 * The routing lives in `testStand/app.ts` (Hono); this is only the Node binding, kept separate so
 * the app can be exercised without a socket.
 */
export async function startTestStandHost(options: TestStandHostOptions = {}): Promise<TestStandHostHandle> {
  const standHtml = await readFile(standHtmlPath);
  const requestLog: RequestLogEntry[] = [];
  const barriers = new Barriers();

  const app = createTestStandApp({ standHtml, requestLog, barriers, defaultShape: options.shape });

  const server: ServerType = await new Promise((resolve) => {
    const created = serve(
      {
        fetch: app.fetch,
        port: options.port ?? 0,
        hostname: options.host ?? "127.0.0.1",
        /**
         * Leave the process's own `Request`/`Response` alone.
         *
         * By default `serve()` swaps `globalThis.Response` for its own implementation, and a
         * response from Node's `fetch` then stops being `instanceof Response`. That breaks any
         * library doing an instance check: our API client's middleware runs inside `openapi-fetch`,
         * which throws "onResponse: must return new Response()" the moment the stand has been
         * started in the same process — which is exactly what the production spot check does.
         *
         * Measured, not guessed: after `serve()` the same fetch result tests true against the
         * pre-`serve` class and false against the replacement.
         */
        overrideGlobalObjects: false,
      },
      () => resolve(created),
    );
  });

  const address = server.address();
  if (typeof address === "string" || address === null) {
    throw new Error("Failed to determine test stand host port");
  }

  const advertisedHost = options.host && options.host !== "0.0.0.0" ? options.host : "127.0.0.1";
  return {
    url: `http://${advertisedHost}:${address.port}/`,
    port: address.port,
    requestLog,
    barriers,
    close: async () => {
      // Release anything still holding, or `close` waits for a socket that will never finish.
      barriers.reset();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
