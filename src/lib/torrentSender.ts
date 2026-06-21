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
 */
export function isTorrentSource(url: string, mime?: string): boolean {
  if (mime === "application/x-bittorrent") return true;
  return /\.torrent(\?|$)/i.test(url) || /\/dl\.php\b/i.test(url);
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
  const name = torrentFileName(response, url);
  const file = new File([blob], name, { type: "application/x-bittorrent" });

  const effectiveSettings = folder ? { ...settings, NASdir: folder } : settings;
  const client = createApiClient({ settings: effectiveSettings });
  const result = await client.addTorrent(file);

  return { name, duplicate: Boolean(result.duplicate) };
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
