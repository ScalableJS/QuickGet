import type { Barriers } from "./barriers.js";

/**
 * How a body is delivered, independent of what the body is.
 *
 * The stand used to have one throttled endpoint (`large-<n>mb.bin`) beside a dozen whole-buffer
 * ones, so "slow" was a place rather than a property. Every knob here is a query parameter on any
 * file route instead, because the interesting cases are combinations: a transfer that stalls at
 * 40%, a large file with no `Content-Length`, a body that stops short of what it promised.
 */
export type TransferShape = {
  /**
   * Bytes per second on the wire.
   *
   * For **watching**, not for asserting. Throughput assertions are inherently racy and none of the
   * tests here make one — the rate exists so a hand-test against a real NAS has a visible progress
   * window instead of an instant completion. Determinism comes from `barrier`, not from this.
   */
  bytesPerSecond?: number;
  /** Silence between the response headers and the first byte — a server that has begun, barely. */
  firstByteDelayMs?: number;
  /** Send this many bytes, then hold at the named barrier until the test releases it. */
  barrierAtByte?: number;
  barrierName?: string;
  /** Destroy the connection after this many bytes. No clean end — a reset mid-file. */
  abortAtByte?: number;
  /**
   * Stop sending after this many bytes but end the response *cleanly*, while `Content-Length`
   * still promises the full size.
   *
   * A different failure from an abort, and the more treacherous one: the socket closes without
   * error, so a client that trusts the close over the declared length will call a partial file
   * complete. Worth more than any bandwidth simulation.
   */
  truncateAtByte?: number;
  /**
   * Omit `Content-Length`, which makes the response chunked.
   *
   * The difference between a progress bar and a spinner: with no declared total, no client can
   * compute a percentage. Our popup renders progress, so this is a real condition to survive, not
   * a synthetic one. No separate "chunked" switch exists — that is what omitting the length does.
   */
  omitContentLength?: boolean;
};

const CHUNK_BYTES = 64 * 1024;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A body of `totalBytes` delivered according to `shape`, starting at `offset` for a range request.
 *
 * Backpressure comes from `pull`: the stream asks for the next chunk only when the consumer has
 * taken the last one. Pushing on a timer instead lets a fast client buffer the whole file in
 * memory, which makes the throttle decorative — measured, not assumed, on the previous
 * implementation before its `drain` wait was added.
 */
export function shapedBody(
  totalBytes: number,
  shape: TransferShape,
  context: { barriers?: Barriers; offset?: number } = {},
): ReadableStream<Uint8Array> {
  const filler = new Uint8Array(CHUNK_BYTES).fill(0x51);
  const delayPerChunk = shape.bytesPerSecond ? (CHUNK_BYTES / shape.bytesPerSecond) * 1000 : 0;
  const stopAt = shape.truncateAtByte ?? totalBytes;
  let sent = context.offset ?? 0;
  let held = false;
  let opened = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!opened) {
        opened = true;
        if (shape.firstByteDelayMs) await sleep(shape.firstByteDelayMs);
      }

      if (shape.abortAtByte !== undefined && sent >= shape.abortAtByte) {
        // An error on the stream is what reaches the socket as a reset. Closing normally here
        // would be a truncated-but-clean response — that is `truncateAtByte`, a different
        // failure, and one a client is far more likely to survive.
        controller.error(new Error("test stand: deliberate mid-transfer abort"));
        return;
      }

      if (!held && shape.barrierAtByte !== undefined && sent >= shape.barrierAtByte) {
        held = true;
        await context.barriers?.hold(shape.barrierName ?? "default");
      }

      if (sent >= stopAt) {
        controller.close();
        return;
      }

      const size = Math.min(CHUNK_BYTES, stopAt - sent);
      controller.enqueue(size === CHUNK_BYTES ? filler : filler.subarray(0, size));
      sent += size;
      if (delayPerChunk > 0) await sleep(delayPerChunk);
    },
  });
}

/** Read a transfer shape out of a URL's query string. Every file route accepts these. */
export function shapeFromQuery(params: URLSearchParams): TransferShape {
  const num = (key: string): number | undefined => {
    const raw = params.get(key);
    if (raw === null) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  };

  const kbps = num("kbps");
  const barrierAtByte = num("barrierAt");
  return {
    bytesPerSecond: kbps ? kbps * 1024 : undefined,
    firstByteDelayMs: num("delayMs"),
    barrierAtByte,
    barrierName: params.get("barrier") ?? (barrierAtByte === undefined ? undefined : "default"),
    abortAtByte: num("abortAt"),
    truncateAtByte: num("truncateAt"),
    omitContentLength: params.get("nolength") === "1",
  };
}

/** Whether any knob was actually asked for, so a bare URL keeps the host's default behaviour. */
export function isShaped(shape: TransferShape): boolean {
  return (
    shape.bytesPerSecond !== undefined ||
    shape.firstByteDelayMs !== undefined ||
    shape.barrierAtByte !== undefined ||
    shape.abortAtByte !== undefined ||
    shape.truncateAtByte !== undefined ||
    shape.omitContentLength === true
  );
}
