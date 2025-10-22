/**
 * Download monitoring via alarms
 * Polls QNAP for download status
 */

import { createApiClient, type ApiClient } from "@api/client.js";
import { loadSettings } from "@lib/settings.js";
import {
  updateBadge,
  clearBadge,
  startIconAnimation,
  stopIconAnimation,
} from "./actions.js";

const ALARM_NAME = "download-monitor";
const CHECK_INTERVAL_MINUTES = 0.1; // ~6 seconds

let isMonitoring = false;
let clientCache: { signature: string; client: ApiClient } | null = null;
let completionTimeout: number | null = null;

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
 * Start monitoring downloads
 */
export function startMonitoring(): void {
  if (isMonitoring) return;

  isMonitoring = true;
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: CHECK_INTERVAL_MINUTES,
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  });
}

/**
 * Stop monitoring downloads
 */
export function stopMonitoring(): void {
  isMonitoring = false;
  chrome.alarms.clear(ALARM_NAME);
  if (completionTimeout !== null) {
    self.clearTimeout(completionTimeout);
    completionTimeout = null;
  }
  stopIconAnimation();
  clearBadge();
}

/**
 * Handle alarm tick
 */
export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name !== ALARM_NAME) return;

  try {
    const client = await getClient();
    const { tasks } = await client.queryTasks();

    if (tasks.length > 0) {
      const totalProgress = tasks.reduce((sum, task) => sum + (task.progress || 0), 0);
      const avgProgress = Math.round(totalProgress / tasks.length);

      updateBadge(avgProgress);
      if (completionTimeout !== null && avgProgress < 100) {
        self.clearTimeout(completionTimeout);
        completionTimeout = null;
      }

      if (avgProgress === 100) {
        stopIconAnimation();
        // All downloads completed
        if (completionTimeout === null) {
          completionTimeout = self.setTimeout(() => {
            completionTimeout = null;
            stopMonitoring();
          }, 5000);
        }
      }
      if (avgProgress < 100) {
        await startIconAnimation();
      }
    } else {
      // No active downloads
      stopMonitoring();
    }
  } catch (error) {
    console.error("Monitoring error:", error);
    // Continue monitoring even on error
  }
}
