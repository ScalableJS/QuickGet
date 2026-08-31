/**
 * Toolbar action (badge + icon) — single authoritative writer.
 *
 * Background owns chrome.action. Every update flows through applyBadgeStats(),
 * which keeps only the last rendered toolbar state and writes only on a real
 * change (uBlock style). Every successful NAS response is authoritative: the
 * first zero clears the badge immediately, while a failed query shows that the
 * task status is unavailable instead of retaining a stale count.
 *
 * The state lives in chrome.storage.session, NOT module globals: MV3 tears the
 * worker down after ~30s idle (≈ our alarm period), and "Any global variables
 * you set will be lost if the service worker shuts down"
 * (developer.chrome.com/docs/extensions/.../service-workers/lifecycle). Session
 * storage is in-memory, survives worker wakes within a browser session, and is
 * cleared on browser restart — exactly like the toolbar badge itself, so the
 * cached value never drifts from what's actually shown.
 *
 * Callers must invoke applyBadgeStats ONLY for a successful NAS query — never
 * on an error/abort/skipped refresh (that would be a fake zero).
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

/**
 * Badge shown when a single send needed something from the user that has nothing to do with
 * the extension or the NAS connection — e.g. a tracker login. Gray, not red: nothing here is
 * broken, and it must never be confused with a configuration/connection fault.
 */
const NOTICE_BADGE = "i";
const NOTICE_BADGE_COLOR = "#9AA0A6";

type IconState = "active" | "idle";

type ToolbarState = {
  badgeText: string;
  icon: IconState | null;
  badgeColor: "green" | "red" | "gray" | null;
  title: string;
  failureReason: string | null;
  failureRevision: number;
};

const STATE_KEY = "qg:toolbarState";
const DEFAULT_STATE: ToolbarState = {
  badgeText: "",
  icon: null,
  badgeColor: null,
  title: "",
  failureReason: null,
  failureRevision: 0,
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
 * writes the badge/icon. It is diff-guarded against the persisted last-rendered
 * state. Returns whether NAS reports idle (so the caller can stop polling).
 * Do NOT call on a failed/aborted/skipped poll.
 */
export async function applyBadgeStats(stats: ProgressSummary): Promise<{ active: number; idleConfirmed: boolean }> {
  return updateState(async (state) => {
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

    // A successful NAS snapshot is authoritative, including the first zero.
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
    await applyConfigurationProblem(state, reason);
  });
}

/**
 * Note that a single send needs the user to do something on the tracker's own site — not an
 * extension or NAS-connection fault. Uses a gray badge, distinct from the red configuration
 * `!`, so the two are never visually confused. An existing hard-error state always outranks
 * this: a real fault must not be papered over by a milder one arriving after it.
 */
export async function markSendNotice(reason: string): Promise<void> {
  await updateState(async (state) => {
    if (state.badgeText === CONFIG_BADGE) return;

    if (state.badgeText !== NOTICE_BADGE) {
      if (await tryActionUpdate("badge", () => chrome.action.setBadgeText({ text: NOTICE_BADGE }))) {
        state.badgeText = NOTICE_BADGE;
      }
    }
    if (state.badgeColor !== "gray") {
      if (
        await tryActionUpdate("badge color", () => chrome.action.setBadgeBackgroundColor({ color: NOTICE_BADGE_COLOR }))
      ) {
        state.badgeColor = "gray";
      }
    }

    const title = `QuickGet: action needed\n${reason}`;
    if (title !== state.title && (await tryActionUpdate("title", () => chrome.action.setTitle({ title })))) {
      state.title = title;
    }
  });
}

/**
 * Replace a live toolbar state with an actionable configuration failure. A new
 * unconfigured installation is deliberately quiet: it has never shown work,
 * so there is no stale status to correct.
 */
export async function markConfigurationProblemAfterActiveState(reason: string): Promise<void> {
  await updateState(async (state) => {
    if (state.icon !== "active" && state.badgeText !== CONFIG_BADGE) return;
    await applyConfigurationProblem(state, reason);
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
    if (!(await tryActionUpdate("badge", () => chrome.action.setBadgeText({ text: "" })))) return reason;

    state.badgeText = "";
    if (await tryActionUpdate("title", () => chrome.action.setTitle({ title: "" }))) state.title = "";
    state.failureReason = null;
    return reason;
  });
}

/** A failed NAS query invalidates the previously displayed task state immediately. */
export async function markMonitoringUnavailable(): Promise<void> {
  await markConfigurationProblem("Cannot reach Download Station — task status is unavailable.");
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

async function applyConfigurationProblem(state: ToolbarState, reason: string): Promise<void> {
  state.failureRevision += 1;
  state.failureReason = reason;

  if (state.badgeText !== CONFIG_BADGE) {
    if (await tryActionUpdate("badge", () => chrome.action.setBadgeText({ text: CONFIG_BADGE }))) {
      state.badgeText = CONFIG_BADGE;
    }
  }
  if (state.badgeColor !== "red") {
    if (
      await tryActionUpdate("badge color", () => chrome.action.setBadgeBackgroundColor({ color: CONFIG_BADGE_COLOR }))
    ) {
      state.badgeColor = "red";
    }
  }

  const title = `QuickGet needs attention\n${reason}`;
  if (title !== state.title && (await tryActionUpdate("title", () => chrome.action.setTitle({ title })))) {
    state.title = title;
  }
}
