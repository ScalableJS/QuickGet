/**
 * Service Worker entry point (Manifest V3)
 * Orchestrates background tasks and event handlers
 */

import { getErrorMessage } from "@lib/errors.js";
import { migrateSettings } from "@lib/settings.js";
import { acknowledgeAttention, applyBadgeStats } from "./actions.js";
import { armMonitoring, ensureMonitoring, handleAlarm } from "./alarms.js";
import { ACKNOWLEDGE_ATTENTION_MESSAGE, type AttentionResponse } from "./attentionMessage.js";
import { refreshContentScripts } from "./contentScripts.js";
import { initDownloadInterception } from "./downloads.js";
import { handleMagnetAdd } from "./magnetHandler.js";
import { createContextMenus, handleContextMenuClick, sendDownloadToStation } from "./menus.js";
import { type BadgeSnapshotMessage, MONITOR_MESSAGE, SNAPSHOT_MESSAGE } from "./monitorMessage.js";

declare const self: ServiceWorkerGlobalScope;

/**
 * An unhandled rejection in the worker surfaces as a bare "(anonymous function)" with no
 * message, which is unusable for diagnosis — and every async listener here can produce one.
 * Naming them costs nothing and turns a stack frame into a sentence.
 */
self.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  console.error("[QuickGet] unhandled rejection in the service worker:", event.reason);
});

self.addEventListener("error", (event: ErrorEvent) => {
  console.error("[QuickGet] uncaught error in the service worker:", event.message, event.error);
});

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
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[QuickGet] Extension installed/updated");
  createContextMenus();
  void migrateSettings().catch((error) => console.error("[QuickGet] Settings migration failed:", error));
  if (details.reason === "update") void refreshContentScripts();
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

// Redirect torrent downloads to the NAS; ordinary-file click interception has its own setting.
initDownloadInterception();

// The background is the single writer of the toolbar action. Other contexts
// (the popup) talk to it by message: MONITOR_MESSAGE arms the poll after a
// mutation; SNAPSHOT_MESSAGE hands over the popup's fresh counts so the badge
// reflects exactly what the popup shows, and arms the poll for after it closes.
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (typeof message !== "object" || message === null) return;
  const type = (message as { type?: unknown }).type;

  if (type === ACKNOWLEDGE_ATTENTION_MESSAGE) {
    void acknowledgeAttention()
      .then((reason) => {
        sendResponse({ reason } satisfies AttentionResponse);
        if (reason) void ensureMonitoring();
      })
      .catch((error) => {
        console.error("[QuickGet] could not acknowledge toolbar attention:", error);
        sendResponse({ reason: null } satisfies AttentionResponse);
      });
    return true;
  }

  if (type === MONITOR_MESSAGE) {
    void ensureMonitoring();
    return;
  }

  if (type === "task:add") {
    const { uri, pageUrl } = message as { uri?: unknown; pageUrl?: unknown };
    if (typeof uri !== "string" || !uri.startsWith("magnet:")) {
      sendResponse({ ok: false, error: "Invalid magnet URI" });
      return;
    }
    void handleMagnetAdd(uri, typeof pageUrl === "string" ? pageUrl : undefined)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: getErrorMessage(error) }));
    return true;
  }

  // Content-script ordinary-file sends use the same transport and routing branch as the context
  // menu. Torrent browser downloads and magnets have their own dedicated event paths.
  if (type === "link:send") {
    const { url } = message as { url?: unknown };
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      sendResponse({ ok: false, error: "Invalid link" });
      return;
    }
    void sendDownloadToStation(url, _sender.tab?.url)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: getErrorMessage(error) }));
    return true;
  }

  if (type === SNAPSHOT_MESSAGE) {
    const { stats } = message as BadgeSnapshotMessage;
    // This is the successful Task/Query the popup just rendered. Its empty
    // result is authoritative for the open app, unlike a lone alarm poll.
    void applyBadgeStats(stats)
      .then(({ downloading, seeding }) => {
        // Seeding keeps the poll armed too: otherwise a seed finishing after the popup closes
        // could never return the icon to idle without reopening the popup.
        if (downloading > 0 || seeding > 0) void armMonitoring();
      })
      .catch((error) => console.error("[QuickGet] could not apply the badge snapshot:", error));
  }
});

console.log("[QuickGet] Service worker loaded");
