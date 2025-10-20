/**
 * Context menu handler
 * Creates and manages extension context menu items
 */

import { loadSettings } from "@lib/settings.js";
import { loginNAS, addDownloadUrl, isTorrentUrl } from "@lib/qnap.js";

/**
 * Create context menu items
 */
export function createContextMenus(): void {
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
}

/**
 * Handle context menu click
 */
export async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
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

    await sendDownloadToStation(url);
  } catch (error) {
    console.error("Context menu error:", error);
    showNotification("Failed to send with QuickGet", (error as Error).message);
  }
}

/**
 * Send download to QNAP
 */
async function sendDownloadToStation(url: string): Promise<void> {
  const settings = await loadSettings();
  const sid = await loginNAS(settings);
  await addDownloadUrl(settings, sid, url);
  showNotification("Success", `Download sent to Download Station: ${url}`);
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

/**
 * Show notification
 */
function showNotification(title: string, message: string): void {
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
