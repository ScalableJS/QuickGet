import path from "node:path";

import { type Context, Hono } from "hono";

import type { Barriers } from "./barriers.js";
import { buildTorrent } from "./torrent.js";
import { isShaped, shapedBody, shapeFromQuery, type TransferShape } from "./transfer.js";

export type RequestLogEntry = {
  path: string;
  method: string;
  /** Present only when the client sent one. The NAS asking for a range is how a resume looks. */
  range?: string;
};

export type TestStandAppOptions = {
  standHtml: Buffer;
  requestLog: RequestLogEntry[];
  barriers: Barriers;
  /** Applied to file routes that ask for no shape of their own. Used by the manual stand. */
  defaultShape?: TransferShape;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  ".mkv": "video/x-matroska",
  ".iso": "application/x-iso9660-image",
  ".pdf": "application/pdf",
};

/**
 * The stand's routes.
 *
 * Three things it must keep doing, all load-bearing in the suite: log every request — that log is
 * how `file-interception.spec.ts` proves *no bytes flowed* — generate a distinct torrent per link,
 * so routing can be tested against a real `info.name`, and serve the page with `no-store`, because
 * the page is edited while it is open and a cached copy makes an edit look like one that never
 * happened.
 */
export function createTestStandApp(options: TestStandAppOptions): Hono {
  const app = new Hono();

  app.use("*", async (c, next) => {
    const range = c.req.header("range");
    options.requestLog.push({
      path: new URL(c.req.url).pathname,
      method: c.req.method,
      ...(range ? { range } : {}),
    });
    await next();
  });

  const queryOf = (url: string): URLSearchParams => new URL(url).searchParams;

  const shapeFor = (params: URLSearchParams): TransferShape => {
    const fromQuery = shapeFromQuery(params);
    return isShaped(fromQuery) ? fromQuery : (options.defaultShape ?? {});
  };

  app.get("/", (c) =>
    c.body(new Uint8Array(options.standHtml), 200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, must-revalidate",
      "content-length": String(options.standHtml.byteLength),
    }),
  );
  app.get("/index.html", (c) => c.redirect("/", 302));

  // An ordinary page. It exists so the stand can prove the *negative*: a link that merely mentions
  // a file in its query string must never be handed to the NAS.
  app.get("/page.html", (c) =>
    c.html("<!doctype html><title>Ordinary page</title><p>This is a web page, not a file.</p>"),
  );

  /**
   * Errors on demand. A download client meets far more 404s, 403s and 503s than it meets exotic
   * bandwidth profiles, and what it does with them is a contract worth pinning.
   */
  app.get("/status/:code", (c) => {
    const code = Number(c.req.param("code"));
    const status = Number.isFinite(code) && code >= 100 && code <= 599 ? code : 500;
    return c.body(`stand: deliberate ${status}`, status as 500, { "content-type": "text/plain; charset=utf-8" });
  });

  /**
   * A chain of redirects ending at a real file.
   *
   * Worth a fixture because the classifier decides from the URL the user clicked, while the bytes
   * arrive from wherever the chain lands — and a real download link is very often a redirect to a
   * CDN. `?hops=` controls the length, `?to=` the destination.
   */
  app.get("/redirect", (c) => {
    const params = queryOf(c.req.url);
    const hops = Math.max(Number(params.get("hops") ?? 1) || 1, 1);
    const to = params.get("to") ?? "/files/plain-clip.mkv";
    if (hops <= 1) return c.redirect(to, 302);
    const next = new URLSearchParams(params);
    next.set("hops", String(hops - 1));
    return c.redirect(`/redirect?${next.toString()}`, 302);
  });

  // A tracker's opaque download endpoint: nothing in the URL says "torrent" or names the release.
  // The MIME type and Content-Disposition are the only signals, exactly as on TorrentPier sites.
  app.get("/dl.php", (c) => {
    const params = queryOf(c.req.url);
    const name = params.get("name") ?? "Tracker.Release.2024.1080p.mkv";
    return serve(c, buildTorrent(name, params.get("multi") === "1"), {
      "content-type": "application/x-bittorrent",
      "content-disposition": `attachment; filename="${name}.torrent"`,
    });
  });

  // The harder variant: correct MIME, no Content-Disposition, no extension. Chrome has no filename
  // to offer, so the only name in existence is inside the file.
  app.get("/get/:name", (c) =>
    serve(c, buildTorrent(decodeURIComponent(c.req.param("name"))), {
      "content-type": "application/x-bittorrent",
    }),
  );

  /**
   * Files. A name ending in `.torrent` is served as one describing the file it is named after;
   * anything else is generated content of whatever size is asked for.
   *
   * Size is a query parameter rather than part of the name (`?mb=256`), so one route covers both
   * "a few dozen bytes, finishes instantly" — right for the automated suite — and "large enough to
   * watch", which is what a hand-test against a real NAS needs. `large-<n>mb.bin` still works: it
   * is linked from the stand page and from notes written during manual testing.
   */
  app.get("/files/:name", (c) => {
    const filename = decodeURIComponent(c.req.param("name"));
    const params = queryOf(c.req.url);

    if (filename.toLowerCase().endsWith(".torrent")) {
      return serve(c, buildTorrent(filename.replace(/\.torrent$/i, "")), {
        "content-type": "application/x-bittorrent",
        "content-disposition": `attachment; filename="${filename}"`,
      });
    }

    const headers = {
      "content-type": MIME_BY_EXTENSION[path.extname(filename).toLowerCase()] ?? "application/octet-stream",
      "content-disposition": `attachment; filename="${filename}"`,
    };

    const asked = Number(params.get("mb"));
    const legacy = /^large-(\d{1,5})mb\.bin$/i.exec(filename);
    const sizeMb = Number.isFinite(asked) && asked > 0 ? asked : legacy ? Number(legacy[1]) : 0;
    if (sizeMb === 0) return serve(c, Buffer.from(`DUMMY DATA FOR ${filename}\n`), headers);

    // A generated body is never materialised: 8 GB of `Buffer.alloc` would be the only thing able
    // to make this route fail for a reason unrelated to what it tests.
    const total = Math.min(sizeMb, 8192) * 1024 * 1024;
    const shape = shapeFor(params);
    return streamed(c, total, shape.bytesPerSecond ? shape : { ...shape, bytesPerSecond: 2 * 1024 * 1024 }, headers);
  });

  app.notFound((c) => c.text("Not found", 404));
  return app;

  /** A known payload, delivered whole unless the query asked for something more interesting. */
  function serve(c: Context, payload: Buffer, headers: Record<string, string>) {
    const shape = shapeFor(queryOf(c.req.url));
    if (!isShaped(shape)) {
      return c.body(new Uint8Array(payload), 200, { ...headers, "content-length": String(payload.byteLength) });
    }
    return streamed(c, payload.byteLength, shape, headers);
  }

  /**
   * A body of known length, streamed.
   *
   * Range handling lives here because it belongs to delivery, not to content: a resumed download
   * asks for the same bytes from an offset. `?noranges=1` answers 200 and the whole body instead,
   * which is what a plain file server does and what the client must also survive.
   */
  function streamed(c: Context, total: number, shape: TransferShape, headers: Record<string, string>) {
    const params = queryOf(c.req.url);
    const rangeHeader = c.req.header("range");
    const honourRanges = params.get("noranges") !== "1";
    const offset = honourRanges ? parseRangeStart(rangeHeader, total) : undefined;

    const head: Record<string, string> = { ...headers, "accept-ranges": honourRanges ? "bytes" : "none" };
    // A truncated body must also close the connection. Under `Content-Length` framing a keep-alive
    // socket that simply stops sending leaves the client waiting for bytes that will never come —
    // a hang, not the premature-close error real truncation produces.
    if (shape.truncateAtByte !== undefined) head.connection = "close";
    if (offset !== undefined) {
      head["content-range"] = `bytes ${offset}-${total - 1}/${total}`;
      if (!shape.omitContentLength) head["content-length"] = String(total - offset);
      return c.body(shapedBody(total, shape, { barriers: options.barriers, offset }), 206, head);
    }

    if (!shape.omitContentLength) head["content-length"] = String(total);
    return c.body(shapedBody(total, shape, { barriers: options.barriers }), 200, head);
  }
}

/** `bytes=N-` / `bytes=N-M`. Only the start matters here; the stand always serves to the end. */
function parseRangeStart(header: string | undefined, total: number): number | undefined {
  if (!header) return undefined;
  const match = /^bytes=(\d+)-/.exec(header.trim());
  if (!match) return undefined;
  const start = Number(match[1]);
  return start > 0 && start < total ? start : undefined;
}
