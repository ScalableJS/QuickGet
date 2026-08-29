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
import type { Settings } from "@lib/config.js";
import { findConfigProblem } from "@lib/configHealth.js";
import { loadSettings } from "@lib/settings.js";
import { summarizeProgress } from "@lib/tasks.js";

import {
  applyBadgeStats,
  markConfigurationProblemAfterActiveState,
  markMonitoringUnavailable,
  noteMonitoringFailure,
} from "./actions.js";

const ALARM_NAME = "download-monitor";
const CHECK_INTERVAL_MINUTES = 0.5; // 30s — Chrome's real minimum since v120

let clientCache: { signature: string; client: ApiClient } | null = null;
let armQueue = Promise.resolve();
let ensureMonitoringOperation: Promise<void> | null = null;
let ensureMonitoringRerun = false;

async function getClient(settings: Settings): Promise<ApiClient> {
  const signature = clientSignature(settings);

  if (!clientCache || clientCache.signature !== signature) {
    clientCache = { signature, client: createApiClient({ settings }) };
  }

  return clientCache.client;
}

/**
 * Arm the background poll if it isn't already. Idempotent: the alarm survives
 * service-worker restarts and is the single source of truth, so re-arming an
 * armed alarm is a no-op rather than a reset.
 */
export async function armMonitoring(): Promise<void> {
  const operation = armQueue.then(async () => {
    const existing = await chrome.alarms.get(ALARM_NAME);
    if (existing) return;
    await chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: CHECK_INTERVAL_MINUTES,
      periodInMinutes: CHECK_INTERVAL_MINUTES,
    });
  });
  armQueue = operation.catch(() => {});
  await operation;
}

/**
 * Arm the poll and reflect status now, so feedback doesn't wait up to 30s for
 * the first tick (e.g. a context-menu add with no popup open). The immediate
 * poll never tears monitoring down — a just-added task may not be counted yet.
 */
export function ensureMonitoring(): Promise<void> {
  if (ensureMonitoringOperation) {
    ensureMonitoringRerun = true;
    return ensureMonitoringOperation;
  }

  ensureMonitoringOperation = runEnsureMonitoring().finally(() => {
    ensureMonitoringOperation = null;
  });
  return ensureMonitoringOperation;
}

async function runEnsureMonitoring(): Promise<void> {
  // Called as fire-and-forget from every listener, so anything that escapes here becomes an
  // unhandled rejection in the worker — which surfaces as a stack frame with no message.
  do {
    ensureMonitoringRerun = false;
    try {
      await armMonitoring();
      await pollStatus({ stopWhenIdle: false });
    } catch (error) {
      console.error("[QuickGet] could not start monitoring:", error);
    }
  } while (ensureMonitoringRerun);
}

/**
 * Handle an alarm tick. Stops polling once idle is *confirmed* (see the
 * hysteresis in applyBadgeStats) — the next mutation re-arms it.
 */
export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name !== ALARM_NAME) return;
  await pollStatus({ stopWhenIdle: true });
}

/**
 * Fetch the task list and hand a confident snapshot to the single toolbar
 * writer. On any failure we keep the last-known badge/icon and keep polling —
 * a transient error must never blank the count.
 */
async function pollStatus({ stopWhenIdle }: { stopWhenIdle: boolean }): Promise<void> {
  try {
    // An unconfigured extension is a normal state, not a fault. Polling anyway threw "NAS
    // address is empty" on every browser start, which Chrome collects on the extension's
    // Errors page — so a fresh install looked broken before it had ever been set up.
    const settings = await loadSettings();
    const problem = findConfigProblem(settings);
    if (problem) {
      await markConfigurationProblemAfterActiveState(problem.summary);
      void chrome.alarms.clear(ALARM_NAME);
      return;
    }

    const client = await getClient(settings);
    const { tasks } = await client.queryTasks();

    const { idleConfirmed } = await applyBadgeStats(summarizeProgress(tasks));

    if (idleConfirmed && stopWhenIdle) {
      // Idle confirmed across consecutive polls — drop the alarm; a mutation re-arms it.
      void chrome.alarms.clear(ALARM_NAME);
    }
  } catch (error) {
    console.error("Monitoring error:", error);
    // Keep the last-known badge/icon. Give up only once failures are sustained,
    // so an unreachable NAS doesn't get polled (and logged) every 30s forever.
    const { giveUp } = await noteMonitoringFailure().catch(() => ({ giveUp: false }));
    if (giveUp) {
      await markMonitoringUnavailable();
      void chrome.alarms.clear(ALARM_NAME);
    }
  }
}
