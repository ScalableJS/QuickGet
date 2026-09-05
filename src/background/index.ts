/**
 * Service Worker entry point (Manifest V3)
 * Orchestrates background tasks and event handlers
 */

import { markInterceptNoticeShown, migrateSettings } from "@lib/settings.js";

import { acknowledgeAttention, applyBadgeStats } from "./actions.js";
import { ACKNOWLEDGE_ATTENTION_MESSAGE, type AttentionResponse } from "./attentionMessage.js";
import { armMonitoring, ensureMonitoring, handleAlarm } from "./alarms.js";
import { initDownloadInterception } from "./downloads.js";
import { createContextMenus, handleContextMenuClick } from "./menus.js";
import { handleMagnetAdd } from "./magnetHandler.js";
import { type BadgeSnapshotMessage, MONITOR_MESSAGE, SNAPSHOT_MESSAGE } from "./monitorMessage.js";
import { getErrorMessage } from "@lib/errors.js";

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
  void runSettingsMigration(details.previousVersion);
  // Reflect any already-running downloads right away after an install/update.
  void ensureMonitoring();
});

/**
 * 1.0.2 wrote the resolved `torrentInterceptMode` default into storage, leaving "off" in
 * profiles that never chose it. That is indistinguishable from a deliberate choice, so the
 * value is left alone and the wording does not assert which of the two happened.
 *
 * The "shown" marker is written only after the notification was actually created, so a
 * failure here does not consume the single delivery.
 */
async function runSettingsMigration(previousVersion?: string): Promise<void> {
  try {
    const { interceptionLeftOff } = await migrateSettings(previousVersion);
    if (!interceptionLeftOff) return;

    await chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/128_download.png"),
      title: "Torrent interception is off",
      message: "Earlier versions could turn it off unintentionally. Check Settings if you expected it on.",
    });
    await markInterceptNoticeShown();
  } catch (error) {
    console.error("[QuickGet] Settings migration failed:", error);
  }
}

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
    const { uri } = message as { uri?: unknown };
    if (typeof uri !== "string" || !uri.startsWith("magnet:")) {
      sendResponse({ ok: false, error: "Invalid magnet URI" });
      return;
    }
    void handleMagnetAdd(uri)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: getErrorMessage(error) }));
    return true;
  }

  if (type === SNAPSHOT_MESSAGE) {
    const { stats } = message as BadgeSnapshotMessage;
    // This is the successful Task/Query the popup just rendered. Its empty
    // result is authoritative for the open app, unlike a lone alarm poll.
    void applyBadgeStats(stats)
      .then(({ active }) => {
        if (active > 0) void armMonitoring();
      })
      .catch((error) => console.error("[QuickGet] could not apply the badge snapshot:", error));
  }
});

console.log("[QuickGet] Service worker loaded");
