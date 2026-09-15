/**
 * What kind of thing a link is, decided once.
 *
 * This used to be two functions in two modules that disagreed: `isTorrentSource` weighed four
 * signals to pick the transport, while a separate `classifyUrl` looked only for a `.torrent`
 * ending and fed the router. A tracker's `dl.php?id=1` was therefore uploaded as a torrent and
 * routed as a plain URL at the same time, and a rule written for `.torrent` never fired on the
 * links it existed for. There is one classifier now, and everything downstream takes its answer.
 *
 * Deliberately dependency-free so both the router and the sender can import it without either
 * importing the other.
 */

export type SourceKind = "url" | "magnet" | "torrent";

/** Response metadata, when the caller has any. A context-menu click has none. */
export type SourceSignals = {
  /** `Content-Type` of the response, if it has already been fetched. */
  mime?: string;
  /**
   * The name the browser settled on, usually from `Content-Disposition`. Worth checking on its
   * own: trackers commonly serve a `.torrent` from an opaque endpoint and reveal the real name
   * nowhere else.
   */
  filename?: string;
};

export function classifySource(url: string, signals: SourceSignals = {}): SourceKind {
  if (isMagnet(url)) return "magnet";
  return isTorrentSource(url, signals) ? "torrent" : "url";
}

export function isMagnet(url: string): boolean {
  return /^magnet:/i.test(url.trim());
}

/** Whether a link should be handed to the NAS as an uploaded `.torrent` rather than as a URL. */
export function isTorrentSource(url: string, signals: SourceSignals = {}): boolean {
  const { mime, filename } = signals;
  if (mime && isTorrentMime(mime)) return true;
  if (filename && hasTorrentExtension(filename)) return true;
  if (hasTorrentExtension(url)) return true;

  // A context-menu click has only the link URL: Chrome has not created a download yet, so there
  // is no response MIME or Content-Disposition-derived filename to inspect. TorrentPier's
  // source-backed download route is /dl.php; keep that fallback only while no contradictory
  // response metadata exists, so an actual PDF served by the same path is never intercepted.
  return !mime && !filename && /\/dl\.php\b/i.test(url);
}

/**
 * Extensions a plain click may hand to the NAS when file interception is on (RES-5).
 *
 * Deliberately a short allow-list of things nobody opens in a browser tab. Two absences are
 * decisions, not omissions:
 *
 * - **`.pdf` is not here.** The browser expectation for a PDF link is the viewer, so sending it
 *   to the NAS on a plain click would take away something the user wanted. An anchor carrying
 *   `download` says otherwise and is honoured separately.
 * - **`.torrent` is not here either**, and `isDownloadableFileUrl` rejects it outright. Torrents
 *   have an unconditional NAS-first transaction in the downloads API; the ordinary-file setting
 *   must never claim or reclassify them.
 */
export const DOWNLOADABLE_FILE_EXTENSIONS: readonly string[] = [
  "7z",
  "apk",
  "appimage",
  "avi",
  "bin",
  "bz2",
  "dmg",
  "exe",
  "flac",
  "gz",
  "img",
  "iso",
  "mkv",
  "mov",
  "mp4",
  "msi",
  "pkg",
  "rar",
  "tar",
  "tgz",
  "vdi",
  "vmdk",
  "webm",
  "xz",
  "zip",
];

const FILE_EXTENSION_PATTERN = new RegExp(`\\.(?:${DOWNLOADABLE_FILE_EXTENSIONS.join("|")})$`, "i");

/**
 * Whether a plain click on this URL should be handed to the NAS instead of the browser.
 *
 * The extension is read from the **pathname only**, which is the whole point: a query string is
 * not a file name. `/movie.mkv?token=abc` is a file; `/page?file=movie.mkv` is a page that
 * mentions one, and sending it would put an HTML document into Download Station.
 *
 * Only `http`/`https`. `blob:`, `data:`, `javascript:`, `file:` and `mailto:` are things the NAS
 * cannot fetch at all, so intercepting them would replace a working click with a failed task.
 */
export function isDownloadableFileUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (isTorrentSource(url)) return false;
  return FILE_EXTENSION_PATTERN.test(parsed.pathname);
}

/** Matches the standard BitTorrent MIME types, ignoring parameters such as charset. */
function isTorrentMime(mime: string): boolean {
  const cleanMime = mime.split(";")[0]?.trim().toLowerCase();
  return cleanMime === "application/x-bittorrent" || cleanMime === "application/x-torrent";
}

/** Matches a `.torrent` ending, allowing a query string or fragment after it. */
export function hasTorrentExtension(value: string): boolean {
  return /\.torrent(?:[?#]|$)/i.test(value);
}

/**
 * A magnet's display name (`dn`), or `undefined` when it carries none — which is common, and is
 * the reason a filename pattern can never catch some magnets.
 *
 * `URLSearchParams` rather than a regexp: a release name routinely contains `=`, and splitting on
 * it used to truncate the name at the first one.
 */
export function magnetDisplayName(uri: string): string | undefined {
  const queryIndex = uri.indexOf("?");
  if (queryIndex === -1) return undefined;
  const displayName = new URLSearchParams(uri.slice(queryIndex + 1)).get("dn")?.trim();
  return displayName || undefined;
}
