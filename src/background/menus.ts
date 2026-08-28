/**
 * Context menu handler
 * Creates and manages extension context menu items
 */

import { createApiClient } from "@api/client.js";
import { getErrorMessage } from "@lib/errors.js";
import { classifyUrl, resolveDestination } from "@lib/routingRules.js";
import { loadSettings } from "@lib/settings.js";
import { recordActivity, sourceHost } from "@lib/activityLog.js";
import { isTorrentSource, sendTorrentUrlToNas } from "@lib/torrentSender.js";

import { ensureMonitoring } from "./alarms.js";
import { notifyDirect } from "./notifier.js";

/**
 * Create context menu items
 */
export function createContextMenus(): void {
  // Remove first so re-running this (onInstalled fires on update/reload, the MV3
  // service worker can restart) never throws "duplicate id".
  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError; // ignore "no items" on a fresh worker
    chrome.contextMenus.create({
      id: "quickget-send-link",
      title: "Send with QuickGet",
      contexts: ["link", "selection"],
    });

    chrome.contextMenus.create({
      id: "quickget-send-page",
      title: "Send current page with QuickGet",
      contexts: ["page"],
    });
  });
}

/**
 * Handle context menu click
 */
export async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
): Promise<void> {
  try {
    let url = "";

    if (info.menuItemId === "quickget-send-link" && info.linkUrl) {
      url = info.linkUrl;
    } else if (info.menuItemId === "quickget-send-link" && info.selectionText) {
      url = info.selectionText.trim();
    } else if (info.menuItemId === "quickget-send-page" && tab?.url) {
      url = tab.url;
    }

    if (!url) {
      throw new Error("No URL found to send");
    }

    // Validate URL
    if (!isValidUrl(url) && !isTorrentUrl(url)) {
      throw new Error("Invalid URL format");
    }

    // The page the link was right-clicked on is the referrer a tracker's hotlink guard expects.
    await sendDownloadToStation(url, tab?.url);
  } catch (error) {
    console.error("Context menu error:", error);
    // A failure the user directly asked for: they are waiting for an answer right now.
    notifyDirect("Failed to send with QuickGet", getErrorMessage(error));
  }
}

/**
 * Send download to QNAP.
 *
 * Torrent sources take the same route as the download interception: fetch the `.torrent` in
 * the browser, where the user's tracker cookies apply, and upload the file itself. Handing the
 * bare URL to the NAS instead fails for anything behind a login — the NAS has no session on the
 * tracker, so a `dl.php`-style link answers with the login page and Download Station stores
 * that HTML as the task.
 *
 * Magnets and ordinary URLs stay on AddUrl: there is no file to fetch, and the NAS needs no
 * session for them.
 */
async function sendDownloadToStation(url: string, referrer?: string): Promise<void> {
  const settings = await loadSettings();
  const targetFolder = resolveDestination({ url, kind: classifyUrl(url) }, settings.routingRules, settings.NASdir);
  console.log("[QuickGet] context menu send", { url, torrent: isTorrentSource(url), targetFolder });

  if (isTorrentSource(url)) {
    const { name, duplicate } = await sendTorrentUrlToNas(settings, url, targetFolder, referrer);
    void ensureMonitoring();
    await recordActivity({ name, source: sourceHost(url), outcome: duplicate ? "duplicate" : "sent" });
    // Silent on success: the user watched themselves click the menu item, and a toast per
    // click is the noise that buried the messages worth reading.
    return;
  }

  const client = createApiClient({ settings });
  await client.addUrl(url, { targetFolder });
  void ensureMonitoring();
  await recordActivity({ name: url, source: sourceHost(url), outcome: "sent" });
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isTorrentUrl(url: string): boolean {
  return /^magnet:/i.test(url) || /\.torrent$/i.test(url);
}
