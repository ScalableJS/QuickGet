/**
 * Toolbar action (badge + icon) — single authoritative writer.
 *
 * Background owns chrome.action. Every update flows through applyBadgeStats(),
 * which keeps the last-known state and writes only on a real change (uBlock
 * style). Idle hysteresis means a single zero never clears the badge — it takes
 * ZERO_CONFIRM consecutive zeros, so a transient NAS hiccup can't blank it.
 *
 * The state lives in chrome.storage.session, NOT module globals: MV3 tears the
 * worker down after ~30s idle (≈ our alarm period), and "Any global variables
 * you set will be lost if the service worker shuts down"
 * (developer.chrome.com/docs/extensions/.../service-workers/lifecycle). Session
 * storage is in-memory, survives worker wakes within a browser session, and is
 * cleared on browser restart — exactly like the toolbar badge itself, so the
 * cached value never drifts from what's actually shown.
 *
 * Callers must invoke applyBadgeStats ONLY for a confident, successful poll —
 * never on an error/abort/skipped refresh (that would be a fake zero); failed
 * polls go through noteMonitoringFailure instead.
 */

import type { ProgressSummary } from "@lib/tasks.js";

import { formatRate } from "../popup/shared/formatters/speed.js";

const IDLE_ICON_PATH = {
  32: "icons/32_download.png",
  128: "icons/128_download.png",
} as const;

const ACTIVE_ICON_PATH = {
  32: "icons/32_active.png",
  128: "icons/128_active.png",
} as const;

// Consecutive confirmed-zero polls required before the badge clears.
const ZERO_CONFIRM = 2;

// Consecutive failed polls before we stop the loop. ~2 min at the 30s period —
// rides out a brief NAS blip, but doesn't poll a truly unreachable NAS forever.
const ERROR_LIMIT = 4;

type IconState = "active" | "idle";

type ToolbarState = {
  badgeText: string;
  icon: IconState | null;
  colorSet: boolean;
  title: string;
  zeroStreak: number;
  errorStreak: number;
};

const STATE_KEY = "qg:toolbarState";
const DEFAULT_STATE: ToolbarState = {
  badgeText: "",
  icon: null,
  colorSet: false,
  title: "",
  zeroStreak: 0,
  errorStreak: 0,
};

async function loadState(): Promise<ToolbarState> {
  const stored = await chrome.storage.session.get(STATE_KEY);
  return { ...DEFAULT_STATE, ...(stored[STATE_KEY] as Partial<ToolbarState> | undefined) };
}

async function saveState(state: ToolbarState): Promise<void> {
  await chrome.storage.session.set({ [STATE_KEY]: state });
}

function buildTitle(stats: ProgressSummary): string {
  return `Active: ${stats.active}\nTotal: ${stats.all}\nDownload: ${formatRate(stats.downRate)}\nUpload: ${formatRate(stats.upRate)}`;
}

/**
 * Apply a confident, successful poll to the toolbar — the ONLY function that
 * writes the badge/icon. Diff-guarded and idle-hysteresis'd against the
 * persisted last-known state. Returns whether idle is now confirmed (so the
 * caller can stop polling). Do NOT call on a failed/aborted/skipped poll.
 */
export async function applyBadgeStats(stats: ProgressSummary): Promise<{ active: number; idleConfirmed: boolean }> {
  const state = await loadState();
  state.errorStreak = 0; // a successful poll resets the failure count

  // Refresh the tooltip only when we actually apply a state — during an idle
  // hold the tooltip keeps matching the count still on the badge.
  const refreshTitle = () => {
    const title = buildTitle(stats);
    if (title !== state.title) {
      chrome.action.setTitle({ title });
      state.title = title;
    }
  };

  if (stats.active > 0) {
    refreshTitle();
    state.zeroStreak = 0;
    const text = String(stats.active);
    if (text !== state.badgeText) {
      chrome.action.setBadgeText({ text });
      state.badgeText = text;
    }
    if (!state.colorSet) {
      chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" }); // green, set once
      state.colorSet = true;
    }
    if (state.icon !== "active") {
      void chrome.action.setIcon({ path: ACTIVE_ICON_PATH });
      state.icon = "active";
    }
    await saveState(state);
    return { active: stats.active, idleConfirmed: false };
  }

  // active === 0 — hold the last badge/icon until the zeros are sustained.
  state.zeroStreak += 1;
  if (state.zeroStreak < ZERO_CONFIRM) {
    await saveState(state);
    return { active: 0, idleConfirmed: false };
  }

  refreshTitle();
  if (state.badgeText !== "") {
    chrome.action.setBadgeText({ text: "" });
    state.badgeText = "";
  }
  if (state.icon !== "idle") {
    void chrome.action.setIcon({ path: IDLE_ICON_PATH });
    state.icon = "idle";
  }
  await saveState(state);
  return { active: 0, idleConfirmed: true };
}

/**
 * Record a failed poll. The badge/icon are left untouched (a transient error
 * must never blank the count). Returns giveUp once failures are sustained, so
 * the caller can stop polling an unreachable NAS instead of retrying forever.
 */
export async function noteMonitoringFailure(): Promise<{ giveUp: boolean }> {
  const state = await loadState();
  state.errorStreak += 1;
  await saveState(state);
  return { giveUp: state.errorStreak >= ERROR_LIMIT };
}

/**
 * Force the toolbar back to idle and forget the cached state. Used on explicit
 * stop / teardown (and to isolate tests).
 */
export async function resetActionState(): Promise<void> {
  chrome.action.setBadgeText({ text: "" });
  void chrome.action.setIcon({ path: IDLE_ICON_PATH });
  await saveState({ ...DEFAULT_STATE, icon: "idle" });
}
