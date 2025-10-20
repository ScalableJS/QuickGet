/**
 * Service Worker entry point (Manifest V3)
 * Orchestrates background tasks and event handlers
 */

import { createContextMenus, handleContextMenuClick } from "./menus.js";
import { handleAlarm, startMonitoring } from "./alarms.js";

// Service worker lifecycle events
self.addEventListener("install", () => {
  console.log("[QuickGet] Service worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[QuickGet] Service worker activated");
  event.waitUntil(clients.claim());
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

// Start monitoring on first context menu click
let firstInteraction = true;
chrome.contextMenus.onClicked.addListener(() => {
  if (firstInteraction) {
    firstInteraction = false;
    startMonitoring();
  }
});

console.log("[QuickGet] Service worker loaded");
