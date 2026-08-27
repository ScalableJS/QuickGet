/**
 * Download interception (Chrome only)
 *
 * Watches for .torrent downloads and routes them to QNAP Download Station.
 * Behaviour is driven by settings.torrentInterceptMode:
 *   - "off"    → do nothing (normal browser download)
 *   - "always" → hand the torrent to the NAS, cancelling the browser download only once
 *                the NAS has accepted it
 */

import type { Settings } from "@lib/config.js";
import { getErrorMessage } from "@lib/errors.js";
import { classifyUrl, resolveDestination } from "@lib/routingRules.js";
import { isLocked, loadSettings } from "@lib/settings.js";
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

/**
 * Hand a `.torrent` download over to the NAS without ever destroying it on failure.
 *
 * The transfer is transactional: pause the browser download, try the hand-off, and only
 * cancel once the NAS has accepted it — otherwise resume and let the browser finish.
 * Cancelling first (as this did until the "ask" mode was removed) loses the file whenever
 * the NAS is unreachable, the credentials are missing, or the URL is single-use.
 */
export async function handleDownloadCreated(item: chrome.downloads.DownloadItem): Promise<void> {
  console.log("[QuickGet] download created:", { id: item.id, url: item.url, finalUrl: item.finalUrl, mime: item.mime });

  try {
    const settings = await loadSettings();
    if (settings.torrentInterceptMode === "off") return;

    const url = item.finalUrl || item.url;
    if (!/^https?:\/\//i.test(url) || !isTorrentSource(url, item.mime)) {
      return; // not a torrent — leave it to the browser
    }

    // No usable credential: either the master password was never entered, or
    // storage.session was emptied by a browser restart. `isLocked()` only distinguishes
    // the two for the message — it reports false in the second case, so it cannot be the
    // guard itself. Leave the download alone; the browser will finish it normally.
    if (!settings.NASpassword) {
      const locked = await isLocked();
      console.warn("[QuickGet] no NAS password — leaving the download to the browser");
      notify(
        locked ? "QuickGet is locked" : "NAS password unavailable",
        "The .torrent was left to the browser. Open QuickGet to unlock or configure it.",
      );
      return;
    }

    await handOffToNas(settings, item.id, url);
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

async function handOffToNas(settings: Settings, downloadId: number, url: string): Promise<void> {
  const paused = await pauseBrowserDownload(downloadId);

  try {
    const folder = resolveDestination({ url, kind: classifyUrl(url) }, settings.routingRules, settings.NASdir);
    const { name, duplicate } = await sendTorrentUrlToNas(settings, url, folder);

    // The NAS owns the torrent now — only here is it safe to drop the browser's copy.
    await cancelBrowserDownload(downloadId);
    void ensureMonitoring();

    if (duplicate) {
      await notifyDuplicate(settings, name);
    } else {
      notify("Torrent sent to NAS", name);
    }
  } catch (error) {
    console.error("[QuickGet] Failed to send torrent:", error);
    if (paused) await resumeBrowserDownload(downloadId);
    notify(
      "Failed to send torrent",
      `${getErrorMessage(error)}${paused ? " — browser download resumed." : ""}`,
    );
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

/**
 * Hold the transfer while the NAS hand-off is attempted. Returns whether the download was
 * actually paused — a `.torrent` is small enough that it may already have finished, and a
 * download that was never paused must not be resumed.
 */
async function pauseBrowserDownload(id: number): Promise<boolean> {
  try {
    await chrome.downloads.pause(id);
    return true;
  } catch {
    return false; // already complete or not in progress
  }
}

async function resumeBrowserDownload(id: number): Promise<void> {
  try {
    await chrome.downloads.resume(id);
  } catch (error) {
    console.warn("[QuickGet] could not resume the browser download:", error);
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
