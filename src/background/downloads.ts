/**
 * Download interception (Chrome only)
 *
 * Watches for .torrent downloads and routes them to QNAP Download Station.
 * Behaviour is driven by settings.torrentInterceptMode:
 *   - "off"    → do nothing (normal browser download)
 *   - "ask"    → cancel the download and show a notification with action buttons
 *   - "always" → cancel and send straight to the NAS default folder
 */

import type { Settings } from "@lib/config.js";
import { getErrorMessage } from "@lib/errors.js";
import { loadSettings } from "@lib/settings.js";
import {
  findExistingTask,
  isRestartable,
  isTorrentSource,
  type PendingTorrent,
  resumeTask,
  sendTorrentUrlToNas,
} from "@lib/torrentSender.js";

import { ensureMonitoring } from "./alarms.js";

const NOTIFICATION_PREFIX = "qg-torrent-";
const RESUME_PREFIX = "qg-resume-";
const PENDING_PREFIX = "pending_";
/** Pending torrents older than this are assumed abandoned (notification dismissed, etc.). */
const PENDING_TTL_MS = 60 * 60 * 1000; // 1 hour
const pendingKey = (id: number): string => `${PENDING_PREFIX}${id}`;

export function initDownloadInterception(): void {
  if (!chrome.downloads?.onCreated) {
    console.warn("[QuickGet] downloads API unavailable — interception disabled");
    return;
  }

  chrome.downloads.onCreated.addListener((item) => {
    void handleDownloadCreated(item);
  });

  chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    void handleNotificationButton(notificationId, buttonIndex);
  });

  // Drop the stashed torrent if the user dismisses the notification without acting.
  chrome.notifications.onClosed.addListener((notificationId) => {
    if (notificationId.startsWith(NOTIFICATION_PREFIX)) {
      const id = Number(notificationId.slice(NOTIFICATION_PREFIX.length));
      if (!Number.isNaN(id)) void chrome.storage.session.remove(pendingKey(id));
    }
  });

  console.log("[QuickGet] download interception listener registered");
}

async function handleDownloadCreated(item: chrome.downloads.DownloadItem): Promise<void> {
  console.log("[QuickGet] download created:", { id: item.id, url: item.url, finalUrl: item.finalUrl, mime: item.mime });

  try {
    const settings = await loadSettings();
    if (settings.torrentInterceptMode === "off") return;

    const url = item.finalUrl || item.url;
    if (!/^https?:\/\//i.test(url) || !isTorrentSource(url, item.mime)) {
      return; // not a torrent — leave it to the browser
    }

    await cancelBrowserDownload(item.id);

    const filename = friendlyName(item, url);

    if (settings.torrentInterceptMode === "always") {
      await sendAndNotify(settings, url);
      return;
    }

    // "ask": stash the pending torrent and present the choice.
    await chrome.storage.session.set({
      [pendingKey(item.id)]: { url, filename, createdAt: Date.now() } satisfies PendingTorrent,
    });
    chrome.notifications.create(`${NOTIFICATION_PREFIX}${item.id}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/128_download.png"),
      title: "Torrent detected",
      message: filename,
      buttons: [{ title: "Send to NAS" }, { title: "Choose folder…" }],
      requireInteraction: true,
    });
  } catch (error) {
    console.error("[QuickGet] Download interception failed:", error);
    notify("Failed to redirect download", getErrorMessage(error));
  }
}

async function handleNotificationButton(notificationId: string, buttonIndex: number): Promise<void> {
  if (notificationId.startsWith(RESUME_PREFIX)) {
    await handleResumeButton(notificationId);
    return;
  }

  if (!notificationId.startsWith(NOTIFICATION_PREFIX)) return;

  const id = Number(notificationId.slice(NOTIFICATION_PREFIX.length));
  chrome.notifications.clear(notificationId);

  const stored = await chrome.storage.session.get(pendingKey(id));
  const pending = stored[pendingKey(id)] as PendingTorrent | undefined;
  if (!pending) {
    console.warn("[QuickGet] no pending torrent for notification", notificationId);
    return;
  }

  if (buttonIndex === 0) {
    // Send to NAS using the default destination folder.
    await chrome.storage.session.remove(pendingKey(id));
    const settings = await loadSettings();
    await sendAndNotify(settings, pending.url);
    return;
  }

  // Choose folder… → open the small chooser window (pending stays in storage).
  await openFolderChooser(id);
}

async function openFolderChooser(id: number): Promise<void> {
  const url = chrome.runtime.getURL(`src/chooser/index.html?id=${id}`);
  await chrome.windows.create({ url, type: "popup", width: 420, height: 320 });
}

async function sendAndNotify(settings: Settings, url: string): Promise<void> {
  try {
    const { name, duplicate } = await sendTorrentUrlToNas(settings, url);
    void ensureMonitoring();
    if (duplicate) {
      await notifyDuplicate(settings, name);
    } else {
      notify("Torrent sent to NAS", name);
    }
  } catch (error) {
    console.error("[QuickGet] Failed to send torrent:", error);
    notify("Failed to send torrent", getErrorMessage(error));
  }
}

/**
 * The torrent is already on the NAS. Inspect the existing task: offer to resume
 * it if it stalled (error/stopped/paused), otherwise just report its status.
 */
async function notifyDuplicate(settings: Settings, name: string): Promise<void> {
  const existing = await findExistingTask(settings, name).catch((error) => {
    console.warn("[QuickGet] could not look up existing task:", error);
    return undefined;
  });

  if (existing?.hash && isRestartable(existing.status)) {
    chrome.notifications.create(`${RESUME_PREFIX}${existing.hash}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/128_download.png"),
      title: `Already on NAS — ${existing.status}`,
      message: name,
      buttons: [{ title: "Resume" }],
      requireInteraction: true,
    });
    return;
  }

  notify("Already on NAS", existing ? `${name} — ${existing.status}` : name);
}

async function handleResumeButton(notificationId: string): Promise<void> {
  chrome.notifications.clear(notificationId);
  const hash = notificationId.slice(RESUME_PREFIX.length);
  if (!hash) return;

  try {
    const settings = await loadSettings();
    await resumeTask(settings, hash);
    notify("Resumed on NAS", "Task restarted");
  } catch (error) {
    console.error("[QuickGet] Failed to resume task:", error);
    notify("Failed to resume task", getErrorMessage(error));
  }
}

async function cancelBrowserDownload(id: number): Promise<void> {
  try {
    await chrome.downloads.cancel(id);
  } catch {
    // Already finished or not cancellable — ignore.
  }
  // Intentionally NOT erasing the item: a cancelled download stays in the
  // browser's download list with a "Retry" affordance, so the user can still
  // fetch the original .torrent normally if the NAS hand-off fails or the
  // notification is dismissed. Erasing it would make the download unrecoverable.
}

/**
 * Remove pending-torrent records that were never acted on (notification
 * dismissed, chooser closed, URL expired). Called on service-worker startup.
 */
export async function sweepStalePending(): Promise<void> {
  try {
    const all = await chrome.storage.session.get(null);
    const now = Date.now();
    const stale = Object.keys(all).filter((key) => {
      if (!key.startsWith(PENDING_PREFIX)) return false;
      const createdAt = (all[key] as Partial<PendingTorrent> | undefined)?.createdAt;
      return typeof createdAt !== "number" || now - createdAt > PENDING_TTL_MS;
    });
    if (stale.length > 0) {
      await chrome.storage.session.remove(stale);
    }
  } catch (error) {
    console.warn("[QuickGet] failed to sweep stale pending torrents:", error);
  }
}

function friendlyName(item: chrome.downloads.DownloadItem, url: string): string {
  if (item.filename) {
    const parts = item.filename.split(/[/\\]/);
    const name = parts[parts.length - 1];
    if (name) return name;
  }
  try {
    return new URL(url).pathname.split("/").pop() || url;
  } catch {
    return url;
  }
}

function notify(title: string, message: string): void {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/128_download.png"),
      title,
      message,
    });
  } catch (error) {
    console.log("Notifications not available:", error);
  }
}
