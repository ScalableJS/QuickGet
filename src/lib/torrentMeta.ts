/**
 * Read the content name out of a `.torrent` file.
 *
 * Routing rules are written against the name of the thing being downloaded, but at the moment
 * a task is created that name is not in the URL: a tracker serves the file from `dl.php?id=1`,
 * and even a tidy `/foo.torrent` link names the metadata file rather than the release inside
 * it. The `.torrent` itself does carry the real name — `info.name`, the file name for a
 * single-file torrent and the directory name for a multi-file one — and we already hold the
 * bytes, because the browser fetches them before uploading to the NAS.
 *
 * This is a targeted reader, not a bencode decoder: it walks the two dictionaries it needs and
 * skips every other value without materialising it, so a multi-megabyte `pieces` blob is never
 * copied. Input comes from a tracker, so every read is bounded and any malformed structure
 * yields `undefined` rather than an exception.
 */

/** A `.torrent` larger than this is not something we will parse; the NAS can still have it. */
const MAX_TORRENT_BYTES = 20 * 1024 * 1024;
/** Nesting past this is malformed for a torrent and is treated as such. */
const MAX_DEPTH = 16;
/** A length prefix longer than this many digits is malformed, and stops `1e308`-style input. */
const MAX_LENGTH_DIGITS = 12;

const CHAR_d = 0x64; // "d"
const CHAR_e = 0x65; // "e"
const CHAR_i = 0x69; // "i"
const CHAR_l = 0x6c; // "l"
const CHAR_COLON = 0x3a; // ":"
const CHAR_0 = 0x30;
const CHAR_9 = 0x39;

type Cursor = { pos: number };

/**
 * The release name declared inside a `.torrent`, or `undefined` when the bytes are not a
 * torrent, are too large to parse, or carry no usable name.
 */
export function readTorrentName(bytes: Uint8Array): string | undefined {
  if (bytes.length === 0 || bytes.length > MAX_TORRENT_BYTES) return undefined;

  try {
    const outer: Cursor = { pos: 0 };
    if (!seekKey(bytes, outer, "info", 0)) return undefined;

    // `name.utf-8` is the legacy escape hatch for clients that wrote a non-UTF-8 `name`;
    // prefer it when both are present. Bencode dictionaries are key-sorted, but the scan is
    // linear either way, so the order tried here is the only precedence that matters.
    for (const key of ["name.utf-8", "name"]) {
      const info: Cursor = { pos: outer.pos };
      if (!seekKey(bytes, info, key, 1)) continue;
      const decoded = decodeUtf8(readByteString(bytes, info)).replace(/\0/g, "").trim();
      if (decoded) return decoded;
    }
  } catch {
    // Malformed input is an answer, not a failure: the caller falls back to the URL.
  }

  return undefined;
}

/**
 * Advance `cursor` from the start of a dictionary to the value stored under `key`.
 * Returns false — with the cursor left unusable — when the dictionary has no such key.
 */
function seekKey(bytes: Uint8Array, cursor: Cursor, key: string, depth: number): boolean {
  if (depth > MAX_DEPTH) throw new Error("bencode: too deeply nested");
  if (bytes[cursor.pos] !== CHAR_d) return false;
  cursor.pos++;

  while (cursor.pos < bytes.length && bytes[cursor.pos] !== CHAR_e) {
    if (decodeUtf8(readByteString(bytes, cursor)) === key) return true;
    skipValue(bytes, cursor, depth + 1);
  }
  return false;
}

/** Move past the value at the cursor, whatever its type, without keeping any of it. */
function skipValue(bytes: Uint8Array, cursor: Cursor, depth: number): void {
  if (depth > MAX_DEPTH) throw new Error("bencode: too deeply nested");
  const tag = bytes[cursor.pos];

  if (tag === CHAR_i) {
    const end = bytes.indexOf(CHAR_e, cursor.pos + 1);
    if (end === -1) throw new Error("bencode: unterminated integer");
    cursor.pos = end + 1;
    return;
  }

  if (tag === CHAR_l || tag === CHAR_d) {
    cursor.pos++;
    while (cursor.pos < bytes.length && bytes[cursor.pos] !== CHAR_e) {
      if (tag === CHAR_d) readByteString(bytes, cursor); // the key, which we do not need
      skipValue(bytes, cursor, depth + 1);
    }
    if (cursor.pos >= bytes.length) throw new Error("bencode: unterminated container");
    cursor.pos++;
    return;
  }

  readByteString(bytes, cursor);
}

/** Read a `<length>:<bytes>` string, returning a view rather than a copy. */
function readByteString(bytes: Uint8Array, cursor: Cursor): Uint8Array {
  const start = cursor.pos;
  let digits = 0;
  while (cursor.pos < bytes.length && bytes[cursor.pos] >= CHAR_0 && bytes[cursor.pos] <= CHAR_9) {
    cursor.pos++;
    digits++;
    if (digits > MAX_LENGTH_DIGITS) throw new Error("bencode: implausible string length");
  }
  if (digits === 0 || bytes[cursor.pos] !== CHAR_COLON) throw new Error("bencode: not a string");

  const length = Number(decodeUtf8(bytes.subarray(start, cursor.pos)));
  cursor.pos++; // the colon
  const end = cursor.pos + length;
  if (end > bytes.length) throw new Error("bencode: string runs past the end");

  const value = bytes.subarray(cursor.pos, end);
  cursor.pos = end;
  return value;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
