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

/** Badge shown when the extension is configured in a way that cannot work. */
const CONFIG_BADGE = "!";
const CONFIG_BADGE_COLOR = "#D93025";

// Consecutive confirmed-zero polls required before the badge clears.
const ZERO_CONFIRM = 2;
const ZERO_CONFIRM_MS = 30_000;

// Consecutive failed polls before we stop the loop. ~2 min at the 30s period —
// rides out a brief NAS blip, but doesn't poll a truly unreachable NAS forever.
const ERROR_LIMIT = 4;

type IconState = "active" | "idle";

type ToolbarState = {
  badgeText: string;
  icon: IconState | null;
  badgeColor: "green" | "red" | null;
  title: string;
  failureReason: string | null;
  failureRevision: number;
  zeroStreak: number;
  firstZeroAt: number | null;
  errorStreak: number;
};

const STATE_KEY = "qg:toolbarState";
const DEFAULT_STATE: ToolbarState = {
  badgeText: "",
  icon: null,
  badgeColor: null,
  title: "",
  failureReason: null,
  failureRevision: 0,
  zeroStreak: 0,
  firstZeroAt: null,
  errorStreak: 0,
};

// This is a same-worker mutex, not authoritative state. The state itself remains in
// storage.session so MV3 worker suspension cannot lose it. Without serialization, two
// get → mutate → set sequences can save in reverse order and erase the newer transition.
let stateUpdateQueue = Promise.resolve();

async function updateState<Result>(update: (state: ToolbarState) => Promise<Result>): Promise<Result> {
  const operation = stateUpdateQueue.then(async () => {
    const state = await loadState();
    const result = await update(state);
    await saveState(state);
    return result;
  });
  stateUpdateQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

async function tryActionUpdate(label: string, update: () => Promise<void>): Promise<boolean> {
  try {
    await update();
    return true;
  } catch (error) {
    console.error(`[QuickGet] could not update toolbar ${label}:`, error);
    return false;
  }
}

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
  return updateState(async (state) => {
    state.errorStreak = 0; // a successful poll resets the failure count
    const needsAttention = state.badgeText === CONFIG_BADGE;

    // Refresh the tooltip only when we actually apply a state — during an idle
    // hold the tooltip keeps matching the count still on the badge.
    const refreshTitle = async () => {
      const title = buildTitle(stats);
      if (title !== state.title && (await tryActionUpdate("title", () => chrome.action.setTitle({ title })))) {
        state.title = title;
      }
    };

    if (stats.active > 0) {
      if (!needsAttention) await refreshTitle();
      state.zeroStreak = 0;
      state.firstZeroAt = null;
      const text = String(stats.active);
      if (!needsAttention && text !== state.badgeText) {
        if (await tryActionUpdate("badge", () => chrome.action.setBadgeText({ text }))) state.badgeText = text;
      }
      if (!needsAttention && state.badgeColor !== "green") {
        if (await tryActionUpdate("badge color", () => chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" }))) {
          state.badgeColor = "green";
        }
      }
      if (state.icon !== "active") {
        if (await tryActionUpdate("icon", () => chrome.action.setIcon({ path: ACTIVE_ICON_PATH }))) {
          state.icon = "active";
        }
      }
      return { active: stats.active, idleConfirmed: false };
    }

    // active === 0 — hold the last badge/icon until the zeros are sustained.
    const now = Date.now();
    if (state.firstZeroAt === null) {
      state.firstZeroAt = now;
      state.zeroStreak = 1;
      return { active: 0, idleConfirmed: false };
    }
    if (now - state.firstZeroAt < ZERO_CONFIRM_MS) return { active: 0, idleConfirmed: false };
    state.zeroStreak = ZERO_CONFIRM;

    if (!needsAttention) await refreshTitle();
    if (!needsAttention && state.badgeText !== "") {
      if (await tryActionUpdate("badge", () => chrome.action.setBadgeText({ text: "" }))) state.badgeText = "";
    }
    if (state.icon !== "idle") {
      if (await tryActionUpdate("icon", () => chrome.action.setIcon({ path: IDLE_ICON_PATH }))) {
        state.icon = "idle";
      }
    }
    return { active: 0, idleConfirmed: true };
  });
}

/**
 * Publish the real start of a browser-download hand-off immediately. An existing attention
 * badge deliberately remains until the user opens the popup and can read its reason.
 */
export async function markInterceptionStarted(): Promise<void> {
  await updateState(async (state) => {
    state.zeroStreak = 0;
    state.firstZeroAt = null;
    // This is an explicit lifecycle event, not a poll. Repaint even when the persisted cache
    // already says active because Chrome's visible action and our cache can drift.
    if (await tryActionUpdate("icon", () => chrome.action.setIcon({ path: ACTIVE_ICON_PATH }))) {
      state.icon = "active";
    }

    if (state.badgeText !== CONFIG_BADGE) {
      const title = "Sending torrent to QNAP…";
      if (await tryActionUpdate("title", () => chrome.action.setTitle({ title }))) state.title = title;
    }

  });
}

/**
 * Put the toolbar into a "this needs your attention" state and keep it there.
 *
 * A misconfiguration is silent by nature: nothing is downloading, so no poll runs and no badge
 * changes — the user only finds out when a torrent quietly fails. A red badge is the one signal
 * visible without opening anything.
 *
 * It deliberately outranks the download count: a count is a status, this is a fault, and the
 * count comes back on the next successful poll once the fault is cleared.
 */
export async function markConfigurationProblem(reason: string): Promise<void> {
  await updateState(async (state) => {
    state.failureRevision += 1;
    state.failureReason = reason;

    if (state.badgeText !== CONFIG_BADGE) {
      if (await tryActionUpdate("badge", () => chrome.action.setBadgeText({ text: CONFIG_BADGE }))) {
        state.badgeText = CONFIG_BADGE;
      }
    }
    if (state.badgeColor !== "red") {
      if (await tryActionUpdate("badge color", () => chrome.action.setBadgeBackgroundColor({ color: CONFIG_BADGE_COLOR }))) {
        state.badgeColor = "red";
      }
    }

    const title = `QuickGet needs attention\n${reason}`;
    if (title !== state.title && (await tryActionUpdate("title", () => chrome.action.setTitle({ title })))) {
      state.title = title;
    }
  });
}

/**
 * Opening the popup is the acknowledgement: return the persisted reason so it can be read in
 * context, then remove the toolbar alarm. The reason has no timer and survives worker sleeps.
 */
export async function acknowledgeAttention(): Promise<string | null> {
  return updateState(async (state) => {
    if (state.badgeText !== CONFIG_BADGE) return null;

    const reason = state.failureReason;
    if (await tryActionUpdate("badge", () => chrome.action.setBadgeText({ text: "" }))) state.badgeText = "";
    if (await tryActionUpdate("title", () => chrome.action.setTitle({ title: "" }))) state.title = "";
    state.failureReason = null;
    return reason;
  });
}

/**
 * Record a failed poll. The badge/icon are left untouched (a transient error
 * must never blank the count). Returns giveUp once failures are sustained, so
 * the caller can stop polling an unreachable NAS instead of retrying forever.
 */
export async function noteMonitoringFailure(): Promise<{ giveUp: boolean }> {
  return updateState(async (state) => {
    state.errorStreak += 1;
    return { giveUp: state.errorStreak >= ERROR_LIMIT };
  });
}

/** Monitoring stopped after sustained failures; never leave a cached active count looking live. */
export async function markMonitoringUnavailable(): Promise<void> {
  await markConfigurationProblem("Cannot reach Download Station — displayed task status may be stale.");
}

/**
 * Force the toolbar back to idle and forget the cached state. Used on explicit
 * stop / teardown (and to isolate tests).
 */
export async function resetActionState(): Promise<void> {
  chrome.action.setBadgeText({ text: "" });
  void chrome.action.setIcon({ path: IDLE_ICON_PATH });
  await updateState(async (state) => {
    Object.assign(state, DEFAULT_STATE, { icon: "idle" });
  });
}
