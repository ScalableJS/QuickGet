/**
 * Download interception (Chrome only)
 *
 * Watches for .torrent downloads and routes them to QNAP Download Station.
 * Behaviour is driven by settings.torrentInterceptMode:
 *   - "off"    → do nothing (normal browser download)
 *   - "always" → cancel and send straight to the NAS default folder
 */

import type { Settings } from "@lib/config.js";
import { getErrorMessage } from "@lib/errors.js";
import { classifyUrl, resolveDestination } from "@lib/routingRules.js";
import { loadSettings } from "@lib/settings.js";
import {
  findExistingTask,
  isRestartable,
  isTorrentSource,
  resumeTask,
  sendTorrentUrlToNas,
} from "@lib/torrentSender.js";

import { ensureMonitoring } from "./alarms.js";

const RESUME_PREFIX = "qg-resume-";

export function initDownloadInterception(): void {
  if (!chrome.downloads?.onCreated) {
    console.warn("[QuickGet] downloads API unavailable — interception disabled");
    return;
  }

  chrome.downloads.onCreated.addListener((item) => {
    void handleDownloadCreated(item);
  });

  chrome.notifications.onButtonClicked.addListener((notificationId) => {
    void handleNotificationButton(notificationId);
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
    await sendAndNotify(settings, url);
  } catch (error) {
    console.error("[QuickGet] Download interception failed:", error);
    notify("Failed to redirect download", getErrorMessage(error));
  }
}

async function handleNotificationButton(notificationId: string): Promise<void> {
  if (notificationId.startsWith(RESUME_PREFIX)) {
    await handleResumeButton(notificationId);
  }
}

async function sendAndNotify(settings: Settings, url: string): Promise<void> {
  try {
    const folder = resolveDestination({ url, kind: classifyUrl(url) }, settings.routingRules, settings.NASdir);
    const { name, duplicate } = await sendTorrentUrlToNas(settings, url, folder);
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
