/**
 * Toolbar action (badge + icon) — single authoritative writer.
 *
 * Background owns chrome.action. Every update flows through applyBadgeStats(),
 * which holds the last-known state and writes only on a real change. Two things
 * keep the count from flickering (uBlock-style):
 *
 *  - Diff guard: setBadgeText/setIcon/setTitle fire only when the value
 *    actually changes; the green badge colour is set once.
 *  - Idle hysteresis: a single empty/zero poll never clears the badge — it
 *    takes ZERO_CONFIRM consecutive zeros. A transient NAS hiccup that reports
 *    0 for one tick no longer blanks the number.
 *
 * Callers must invoke applyBadgeStats ONLY for a confident, successful poll —
 * never on an error, abort, or skipped refresh (that would be a fake zero).
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

type IconState = "active" | "idle";

// Authoritative last-known toolbar state. Resets when the service worker is torn
// down, which is harmless: a fresh icon=null / "" never equals a real value, so
// the first poll after a restart always re-syncs the toolbar.
const state: {
  badgeText: string;
  icon: IconState | null;
  colorSet: boolean;
  title: string;
  zeroStreak: number;
} = { badgeText: "", icon: null, colorSet: false, title: "", zeroStreak: 0 };

function buildTitle(stats: ProgressSummary): string {
  return `Active: ${stats.active}\nTotal: ${stats.all}\nDownload: ${formatRate(stats.downRate)}\nUpload: ${formatRate(stats.upRate)}`;
}

function writeBadgeText(text: string): void {
  if (text === state.badgeText) return;
  state.badgeText = text;
  chrome.action.setBadgeText({ text });
}

function writeIcon(icon: IconState): void {
  if (icon === state.icon) return;
  state.icon = icon;
  void chrome.action.setIcon({ path: icon === "active" ? ACTIVE_ICON_PATH : IDLE_ICON_PATH });
}

function writeTitle(stats: ProgressSummary): void {
  const title = buildTitle(stats);
  if (title === state.title) return;
  state.title = title;
  chrome.action.setTitle({ title });
}

/**
 * Apply a confident, successful poll to the toolbar — the ONLY function that
 * writes chrome.action. Returns whether idle is now confirmed (so the caller
 * can stop polling). Do NOT call on a failed/aborted/skipped poll.
 */
export function applyBadgeStats(stats: ProgressSummary): { active: number; idleConfirmed: boolean } {
  writeTitle(stats); // tooltip only — invisible, safe to refresh

  if (stats.active > 0) {
    state.zeroStreak = 0;
    writeBadgeText(String(stats.active));
    if (!state.colorSet) {
      chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" }); // green, set once
      state.colorSet = true;
    }
    writeIcon("active");
    return { active: stats.active, idleConfirmed: false };
  }

  // active === 0 — hold the last badge/icon until the zeros are sustained.
  state.zeroStreak += 1;
  if (state.zeroStreak < ZERO_CONFIRM) {
    return { active: 0, idleConfirmed: false };
  }

  writeBadgeText("");
  writeIcon("idle");
  return { active: 0, idleConfirmed: true };
}

/**
 * Force the toolbar back to idle and forget the cached state. Used on explicit
 * stop / teardown (and to isolate tests).
 */
export function resetActionState(): void {
  state.badgeText = "";
  state.icon = "idle";
  state.colorSet = false;
  state.title = "";
  state.zeroStreak = 0;
  chrome.action.setBadgeText({ text: "" });
  void chrome.action.setIcon({ path: IDLE_ICON_PATH });
}
