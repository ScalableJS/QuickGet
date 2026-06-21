import type { ProgressSummary } from "@lib/tasks.js";

/** Runtime message any context posts to ask the service worker to arm the badge poll. */
export const MONITOR_MESSAGE = "qg:ensureMonitoring";

/**
 * Snapshot the popup pushes on every successful refresh. The background is the
 * single writer of the toolbar, so the popup never touches chrome.action — it
 * just hands over the numbers it already computed for the In-progress tab.
 */
export const SNAPSHOT_MESSAGE = "qg:badgeSnapshot";

export type BadgeSnapshotMessage = {
  type: typeof SNAPSHOT_MESSAGE;
  stats: ProgressSummary;
};
