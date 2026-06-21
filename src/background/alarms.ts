/**
 * Download monitoring via alarms
 *
 * Polls QNAP for aggregated Download Station status and reflects it on the
 * toolbar badge. Two deliberate constraints shaped this design:
 *
 *  - Chrome 120+ clamps any alarm period below 0.5 min to 30 seconds (and logs
 *    a warning), so 0.5 is the real floor — a "6 second" period was never
 *    honoured. We poll at the 30s minimum.
 *  - The MV3 service worker is torn down when idle, so in-memory monitoring
 *    flags/timers desync from reality after a restart. We keep no such flags:
 *    chrome.alarms persist across restarts and are the single source of truth.
 */

import { type ApiClient, createApiClient } from "@api/client.js";
import { clientSignature } from "@lib/clientSignature.js";
import { loadSettings } from "@lib/settings.js";

import { clearBadge, reflectTasksOnAction, setIdleIcon } from "./actions.js";

const ALARM_NAME = "download-monitor";
const CHECK_INTERVAL_MINUTES = 0.5; // 30s — Chrome's real minimum since v120

let clientCache: { signature: string; client: ApiClient } | null = null;

async function getClient(): Promise<ApiClient> {
  const settings = await loadSettings();
  const signature = clientSignature(settings);

  if (!clientCache || clientCache.signature !== signature) {
    clientCache = { signature, client: createApiClient({ settings }) };
  }

  return clientCache.client;
}

/**
 * Ensure the background poll is armed. Idempotent and cheap, so it can be called
 * after every task mutation (add/start/stop/remove) from any context. Because
 * the alarm itself survives service-worker restarts, re-arming an already-armed
 * alarm is a no-op rather than a reset.
 */
export async function ensureMonitoring(): Promise<void> {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: CHECK_INTERVAL_MINUTES,
      periodInMinutes: CHECK_INTERVAL_MINUTES,
    });
  }

  // Instant feedback: the alarm's first tick is up to 30s away, so reflect
  // status now. Don't tear monitoring down here — a just-added task may not be
  // counted as active yet; the next periodic tick handles the idle case.
  await pollStatus({ stopWhenIdle: false });
}

/**
 * Stop monitoring downloads
 */
export function stopMonitoring(): void {
  void chrome.alarms.clear(ALARM_NAME);
  setIdleIcon();
  clearBadge();
}

/**
 * Handle alarm tick. Uses the cheap aggregated status endpoint (no task array)
 * and stops polling once nothing is active — the next mutation re-arms it.
 */
export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name !== ALARM_NAME) return;
  await pollStatus({ stopWhenIdle: true });
}

/**
 * Fetch aggregated status, reflect it on the badge and toolbar icon. When
 * `stopWhenIdle` is set, an idle result also clears the badge and stops polling.
 */
async function pollStatus({ stopWhenIdle }: { stopWhenIdle: boolean }): Promise<void> {
  try {
    const client = await getClient();
    // Use the task list (not the cheap Task/Status aggregate) so "active" means
    // exactly what the popup's In-progress tab means. The aggregate has no
    // finishing/checking/queued counters, so a task in "finishing" (download
    // done, still post-processing) would drop the badge while the popup still
    // shows it working. Once per 30s, pulling the list is cheap enough.
    const { tasks } = await client.queryTasks();

    // Same helper the popup uses, so the toolbar always agrees with the
    // In-progress tab regardless of which context updated it last.
    const { activeCount } = reflectTasksOnAction(tasks);

    if (activeCount === 0 && stopWhenIdle) {
      // Nothing in progress — also drop the alarm; the next mutation re-arms it.
      stopMonitoring();
    }
  } catch (error) {
    console.error("Monitoring error:", error);
    // Continue monitoring even on transient errors.
  }
}
