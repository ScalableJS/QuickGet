/**
 * Service Worker entry point (Manifest V3)
 * Orchestrates background tasks and event handlers
 */

import { ensureMonitoring, handleAlarm } from "./alarms.js";
import { initDownloadInterception, sweepStalePending } from "./downloads.js";
import { createContextMenus, handleContextMenuClick } from "./menus.js";
import { MONITOR_MESSAGE } from "./monitorMessage.js";

declare const self: ServiceWorkerGlobalScope;

// Service worker lifecycle events
self.addEventListener("install", (event: ExtendableEvent) => {
  console.log("[QuickGet] Service worker installed");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  console.log("[QuickGet] Service worker activated");
  event.waitUntil(self.clients.claim());
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("[QuickGet] Extension installed/updated");
  createContextMenus();
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

// Alarm handler for download monitoring
chrome.alarms.onAlarm.addListener(handleAlarm);

// Redirect browser downloads to the NAS when enabled in settings
initDownloadInterception();

// Other contexts (the popup) can't call ensureMonitoring() directly, so they
// post a message after any task mutation and we arm the poll here.
chrome.runtime.onMessage.addListener((message: unknown) => {
  if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === MONITOR_MESSAGE) {
    void ensureMonitoring();
  }
});

// Drop any pending-torrent records left over from a previous session.
void sweepStalePending();

console.log("[QuickGet] Service worker loaded");
