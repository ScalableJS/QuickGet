/**
 * Badge and action updates
 * Manages the extension toolbar badge, icon state, and title.
 *
 * Note: the toolbar icon is swapped between two static states (idle/active)
 * rather than animated. MV3 service workers are torn down when idle, so a
 * setInterval-driven animation freezes within seconds and cannot be kept alive
 * reliably. A status-matched icon survives worker teardown because Chrome
 * persists the action state itself.
 */

import { isInProgress, type Task } from "@lib/tasks.js";

import { formatRate } from "../popup/shared/formatters/speed.js";

const IDLE_ICON_PATH = {
  32: "icons/32_download.png",
  128: "icons/128_download.png",
} as const;

const ACTIVE_ICON_PATH = {
  32: "icons/32_active.png",
  128: "icons/128_active.png",
} as const;

export interface BadgeStats {
  active: number;
  all: number;
  downRate: number;
  upRate: number;
}

/**
 * Update badge with aggregated download-station stats: active-task count on the
 * badge, full breakdown in the icon tooltip.
 */
export function updateStatsBadge(stats: BadgeStats): void {
  const text = stats.active > 0 ? String(stats.active) : "";

  chrome.action.setBadgeText({ text });
  if (stats.active > 0) {
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" }); // Green
  }

  setActionTitle(
    `Active: ${stats.active}\nTotal: ${stats.all}\nDownload: ${formatRate(stats.downRate)}\nUpload: ${formatRate(stats.upRate)}`,
  );
}

/**
 * Clear badge
 */
export function clearBadge(): void {
  chrome.action.setBadgeText({ text: "" });
}

/**
 * Set action title
 */
export function setActionTitle(title: string): void {
  chrome.action.setTitle({ title });
}

/**
 * Show the "downloading" icon while tasks are active.
 */
export function setActiveIcon(): void {
  void chrome.action.setIcon({ path: ACTIVE_ICON_PATH });
}

/**
 * Reset the toolbar icon to its default idle state.
 */
export function setIdleIcon(): void {
  void chrome.action.setIcon({ path: IDLE_ICON_PATH });
}

/**
 * Reflect a task list on the toolbar (badge count, rates, active/idle icon).
 * Shared by the background poll and the popup so both agree on what "active"
 * means (the same isInProgress() the In-progress tab uses). Returns the
 * in-progress count so the caller can decide whether to keep polling.
 */
export function reflectTasksOnAction(tasks: Task[]): { activeCount: number } {
  const activeCount = tasks.filter((task) => isInProgress(task.status)).length;
  const downRate = tasks.reduce((sum, task) => sum + task.downSpeedBps, 0);
  const upRate = tasks.reduce((sum, task) => sum + task.upSpeedBps, 0);

  updateStatsBadge({ active: activeCount, all: tasks.length, downRate, upRate });

  if (activeCount > 0) {
    setActiveIcon();
  } else {
    setIdleIcon();
  }

  return { activeCount };
}
