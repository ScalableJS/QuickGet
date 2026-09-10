/**
 * Context menu handler
 * Creates and manages extension context menu items
 */

import { createApiClient } from "@api/client.js";
import { getErrorMessage } from "@lib/errors.js";
import { resolveDestination } from "@lib/routingRules.js";
import { loadSettings } from "@lib/settings.js";
import { classifySource } from "@lib/sourceKind.js";
import { sendTorrentUrlToNas } from "@lib/torrentSender.js";
import { markConfigurationProblem } from "./actions.js";
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
      title: "Send to Download Station",
      contexts: ["link"],
      documentUrlPatterns: ["*://*/*"],
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
    }

    if (!url) {
      throw new Error("No URL found to send");
    }

    // Validate URL
    if (!isSupportedUrl(url)) {
      throw new Error("Only web and magnet links are supported");
    }

    // The page the link was right-clicked on is the referrer a tracker's hotlink guard expects.
    await sendDownloadToStation(url, tab?.url);
  } catch (error) {
    console.error("Context menu error:", error);
    // A failure the user directly asked for: they are waiting for an answer right now.
    notifyDirect("Failed to send download", getErrorMessage(error));
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
  // One classification decides both the transport and the routing, so the two can never
  // disagree about what a link is — a `dl.php` torrent used to be uploaded as a torrent and
  // routed as a plain URL at the same time.
  const kind = classifySource(url);
  const route = (name?: string) => {
    const targetFolder = resolveDestination(
      { url, kind, name, pageUrl: referrer },
      settings.routingRules,
      settings.NASdir,
    );
    console.log("[QuickGet] context menu send", { url, kind, name, pageUrl: referrer, targetFolder });
    return targetFolder;
  };

  try {
    if (kind === "torrent") {
      // Resolved inside: the release name only exists once the .torrent has been fetched.
      await sendTorrentUrlToNas(settings, url, route, referrer);
    } else {
      const client = createApiClient({ settings });
      await client.addUrl(url, { targetFolder: route() });
    }

    void ensureMonitoring();
    // Silent on success: the user watched themselves click the menu item, and a toast per
    // click is the noise that buried the messages worth reading.
  } catch (error) {
    await markConfigurationProblem(getErrorMessage(error));
    throw error;
  }
}

/**
 * Validate URL format
 */
function isSupportedUrl(url: string): boolean {
  if (/^magnet:/i.test(url)) return true;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
