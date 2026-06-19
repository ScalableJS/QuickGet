import { MONITOR_MESSAGE } from "@/background/monitorMessage.js";

/**
 * Ask the background service worker to (re)arm the badge poll. Called after any
 * popup-initiated task mutation so the toolbar badge starts updating without
 * waiting for a context-menu click. Best-effort: a missing receiver is ignored.
 */
export function requestMonitoring(): void {
  try {
    void chrome.runtime.sendMessage({ type: MONITOR_MESSAGE }).catch(() => {});
  } catch {
    // sendMessage can throw synchronously if the runtime is unavailable — ignore.
  }
}
