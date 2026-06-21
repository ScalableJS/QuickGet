/**
 * Service Worker entry point (Manifest V3)
 * Orchestrates background tasks and event handlers
 */

import { applyBadgeStats } from "./actions.js";
import { armMonitoring, ensureMonitoring, handleAlarm } from "./alarms.js";
import { initDownloadInterception } from "./downloads.js";
import { createContextMenus, handleContextMenuClick } from "./menus.js";
import { type BadgeSnapshotMessage, MONITOR_MESSAGE, SNAPSHOT_MESSAGE } from "./monitorMessage.js";

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
  // Reflect any already-running downloads right away after an install/update.
  void ensureMonitoring();
});

// Cold browser start: nothing has opened the popup or mutated a task yet, so
// without this the toolbar would sit at its stale value until the user clicks.
// Poll once now (and arm the alarm) so an already-active download shows up.
chrome.runtime.onStartup.addListener(() => {
  console.log("[QuickGet] Browser startup — checking downloads");
  void ensureMonitoring();
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

// Alarm handler for download monitoring
chrome.alarms.onAlarm.addListener(handleAlarm);

// Redirect browser downloads to the NAS when enabled in settings
initDownloadInterception();

// The background is the single writer of the toolbar action. Other contexts
// (the popup) talk to it by message: MONITOR_MESSAGE arms the poll after a
// mutation; SNAPSHOT_MESSAGE hands over the popup's fresh counts so the badge
// reflects exactly what the popup shows, and arms the poll for after it closes.
chrome.runtime.onMessage.addListener((message: unknown) => {
  if (typeof message !== "object" || message === null) return;
  const type = (message as { type?: unknown }).type;

  if (type === MONITOR_MESSAGE) {
    void ensureMonitoring();
    return;
  }

  if (type === SNAPSHOT_MESSAGE) {
    const { stats } = message as BadgeSnapshotMessage;
    const { active } = applyBadgeStats(stats);
    if (active > 0) void armMonitoring();
  }
});

console.log("[QuickGet] Service worker loaded");
