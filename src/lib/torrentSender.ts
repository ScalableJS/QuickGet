/**
 * Shared torrent-send logic.
 *
 * The .torrent is fetched in the browser (sending the user's tracker cookies via
 * credentials: "include") and uploaded to the NAS through AddTorrent. Sending the
 * bare URL would fail for private trackers because the NAS has no session there.
 */

import { createApiClient } from "@api/client.js";
import type { Settings } from "./config.js";
import { fetchFromPageContext } from "./tabFetch.js";
import type { Task, TaskStatus } from "./tasks.js";

export type SendTorrentResult = {
  name: string;
  duplicate: boolean;
};

/** Statuses where a re-clicked torrent can be resumed instead of re-added. */
const RESTARTABLE_STATUSES: readonly TaskStatus[] = ["error", "stopped", "paused"];

export function isRestartable(status: TaskStatus): boolean {
  return RESTARTABLE_STATUSES.includes(status);
}

/**
 * Find the NAS task that corresponds to a torrent file name (fuzzy match,
 * since the task name on the NAS usually drops the .torrent extension).
 */
export async function findExistingTask(settings: Settings, torrentName: string): Promise<Task | undefined> {
  const client = createApiClient({ settings });
  const { tasks } = await client.queryTasks({ params: { limit: 0 } });
  const target = normalizeName(torrentName);
  if (!target) return undefined;

  return tasks.find((task) => {
    const name = normalizeName(task.name);
    return name === target || name.includes(target) || target.includes(name);
  });
}

/** Resume a paused/stopped/errored task on the NAS. */
export async function resumeTask(settings: Settings, hash: string): Promise<void> {
  const client = createApiClient({ settings });
  await client.startTask(hash);
}

function normalizeName(value: string): string {
  return value
    .replace(/\.torrent$/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Decide whether a download is a torrent source that must be routed to the NAS.
 *
 * `filename` is worth checking on its own: trackers commonly serve a `.torrent` from an
 * opaque endpoint and only reveal the real name through `Content-Disposition`, which Chrome
 * surfaces as the download item's filename rather than in the URL.
 */
export function isTorrentSource(url: string, mime?: string, filename?: string): boolean {
  if (mime && isTorrentMime(mime)) return true;
  if (filename && hasTorrentExtension(filename)) return true;
  if (hasTorrentExtension(url)) return true;

  // A context-menu click has only the link URL: Chrome has not created a download yet, so
  // there is no response MIME or Content-Disposition-derived filename to inspect. TorrentPier's
  // source-backed download route is /dl.php; keep that fallback only while no contradictory
  // response metadata exists, so an actual PDF served by the same path is never intercepted.
  return !mime && !filename && /\/dl\.php\b/i.test(url);
}

/** Matches standard BitTorrent MIME type, ignoring optional parameters like charset. */
function isTorrentMime(mime: string): boolean {
  const cleanMime = mime.split(";")[0]?.trim().toLowerCase();
  return cleanMime === "application/x-bittorrent" || cleanMime === "application/x-torrent";
}

/** Matches a `.torrent` ending, allowing for a query string or a fragment after it. */
function hasTorrentExtension(value: string): boolean {
  return /\.torrent(?:[?#]|$)/i.test(value);
}

/**
 * Fetch a .torrent with the browser's cookies and upload it to the NAS.
 * Pass `folder` to override the final destination directory for this task.
 */
export async function sendTorrentUrlToNas(
  settings: Settings,
  url: string,
  folder?: string,
  referrer?: string,
): Promise<SendTorrentResult> {
  // A page on the tracker is the only context whose request looks like a real click. The
  // worker's own fetch is the fallback for sources that need no session at all.
  const response = (await fetchFromPageContext(url, referrer)) ?? (await fetch(url, { credentials: "include" }));

  if (!response.ok) {
    throw new Error(
      response.status === 403 || response.status === 401
        ? `The tracker refused the download (HTTP ${response.status}). Open the topic page and make sure you are logged in.`
        : `Fetch torrent failed: HTTP ${response.status}`,
    );
  }

  const blob = await response.blob();
  await assertLooksLikeTorrent(blob, response);

  const name = torrentFileName(response, url);
  const file = new File([blob], name, { type: "application/x-bittorrent" });

  const effectiveSettings = folder ? { ...settings, NASdir: folder } : settings;
  const client = createApiClient({ settings: effectiveSettings });
  const result = await client.addTorrent(file);

  return { name, duplicate: Boolean(result.duplicate) };
}

/**
 * Trackers answer an unauthenticated request with a login page rather than a 4xx, so a
 * successful HTTP status proves nothing. Uploading that HTML would create a task on the NAS
 * for a file that is not a torrent — the symptom this check exists to turn into a real error.
 *
 * A `.torrent` is bencoded, so it always starts with `d` followed by a digit (the first key's
 * length), e.g. `d8:announce`.
 */
async function assertLooksLikeTorrent(blob: Blob, response: Response): Promise<void> {
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  const bencodedDict = head[0] === 0x64 && head[1] >= 0x30 && head[1] <= 0x39; // "d" + digit
  if (bencodedDict) return;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-bittorrent")) return;

  throw new Error(
    contentType.includes("text/html")
      ? "The tracker returned a web page, not a .torrent — you may need to log in to it first."
      : "The downloaded file is not a .torrent.",
  );
}

/**
 * Derive the torrent file name from the HTTP response headers (Content-Disposition)
 * or fallback to the URL pathname, adhering to RFC 6266 and RFC 5987.
 */
function torrentFileName(response: Response, url: string): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const fromHeader = parseContentDispositionFilename(disposition);
  if (fromHeader) {
    const base = fromHeader.split(/[/\\]/).pop()?.trim();
    if (base) return base;
  }

  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").pop();
    if (last) {
      const decoded = decodeURIComponent(last).trim();
      if (hasTorrentExtension(decoded)) return decoded;
    }
  } catch {
    // ignore invalid URL
  }

  return "download.torrent";
}

/**
 * Parse filename from Content-Disposition header according to RFC 6266 / RFC 5987.
 * Gives precedence to `filename*` parameter over `filename`.
 */
function parseContentDispositionFilename(disposition: string): string | undefined {
  if (!disposition) return undefined;

  // RFC 6266 Section 4.3 / RFC 5987 Section 3.2: filename* takes precedence over filename.
  // Format: filename*=charset'[language]'value-chars
  const extMatch = disposition.match(/filename\*\s*=\s*(?:([a-zA-Z0-9_-]+)'([a-zA-Z0-9_-]*)'|["']?)([^;\n"']+)/i);
  if (extMatch) {
    const charset = extMatch[1]?.toUpperCase() ?? "UTF-8";
    const rawVal = extMatch[3]?.trim();
    if (rawVal) {
      try {
        if (charset === "ISO-8859-1" || charset === "LATIN1") {
          return rawVal.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        }
        return decodeURIComponent(rawVal);
      } catch {
        return rawVal;
      }
    }
  }

  // Standard filename parameter: filename="value" or filename=value or filename='value'
  const stdMatch = disposition.match(/filename\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s\n]+))/i);
  const stdVal = stdMatch?.[1] ?? stdMatch?.[2] ?? stdMatch?.[3];
  if (stdVal) {
    const trimmed = stdVal.trim();
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }

  return undefined;
}
