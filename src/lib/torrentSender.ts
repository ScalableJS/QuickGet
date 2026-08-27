/**
 * Shared torrent-send logic.
 *
 * The .torrent is fetched in the browser (sending the user's tracker cookies via
 * credentials: "include") and uploaded to the NAS through AddTorrent. Sending the
 * bare URL would fail for private trackers because the NAS has no session there.
 */

import { createApiClient } from "@api/client.js";
import type { Settings } from "./config.js";
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
  if (mime === "application/x-bittorrent") return true;
  if (filename && hasTorrentExtension(filename)) return true;
  return hasTorrentExtension(url) || /\/dl\.php\b/i.test(url);
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
): Promise<SendTorrentResult> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Fetch torrent failed: HTTP ${response.status}`);
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
 * Trackers answer an unauthenticated `dl.php` with the login page rather than a 4xx, so a
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

function torrentFileName(response: Response, url: string): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1].trim());
    } catch {
      return match[1].trim();
    }
  }

  try {
    const last = new URL(url).pathname.split("/").pop();
    if (last && /\.torrent$/i.test(last)) return last;
  } catch {
    // ignore
  }

  return "download.torrent";
}
