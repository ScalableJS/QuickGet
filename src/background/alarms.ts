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
import { loadSettings } from "@lib/settings.js";

import { clearBadge, startIconAnimation, stopIconAnimation, updateStatsBadge } from "./actions.js";

const ALARM_NAME = "download-monitor";
const CHECK_INTERVAL_MINUTES = 0.5; // 30s — Chrome's real minimum since v120

let clientCache: { signature: string; client: ApiClient } | null = null;

function serializeSettings(settings: Awaited<ReturnType<typeof loadSettings>>): string {
  return JSON.stringify([
    settings.NASsecure,
    settings.NASaddress,
    settings.NASport,
    settings.NASlogin,
    settings.NASpassword,
    settings.NAStempdir,
    settings.NASdir,
  ]);
}

async function getClient(): Promise<ApiClient> {
  const settings = await loadSettings();
  const signature = serializeSettings(settings);

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
  if (existing) return;
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: CHECK_INTERVAL_MINUTES,
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  });
}

/**
 * Stop monitoring downloads
 */
export function stopMonitoring(): void {
  void chrome.alarms.clear(ALARM_NAME);
  stopIconAnimation();
  clearBadge();
}

/**
 * Handle alarm tick. Uses the cheap aggregated status endpoint (no task array)
 * and stops polling once nothing is active — the next mutation re-arms it.
 */
export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name !== ALARM_NAME) return;

  try {
    const client = await getClient();
    const status = await client.getStatus();

    updateStatsBadge({
      active: status.active,
      all: status.all,
      downRate: status.down_rate,
      upRate: status.up_rate,
    });

    if (status.active > 0) {
      await startIconAnimation();
    } else {
      // Nothing downloading — clear the badge/animation and stop polling.
      stopMonitoring();
    }
  } catch (error) {
    console.error("Monitoring error:", error);
    // Continue monitoring even on transient errors.
  }
}
