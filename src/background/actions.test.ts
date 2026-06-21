import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyBadgeStats, noteMonitoringFailure, resetActionState } from "./actions.js";

const stats = (active: number, extra: Partial<{ all: number; downRate: number; upRate: number }> = {}) => ({
  active,
  all: extra.all ?? 6,
  downRate: extra.downRate ?? 0,
  upRate: extra.upRate ?? 0,
});

describe("applyBadgeStats", () => {
  beforeEach(async () => {
    await resetActionState(); // clean persisted state between cases
    vi.clearAllMocks(); // ...then forget the writes resetActionState just made
  });

  it("shows the active count and the active icon", async () => {
    await applyBadgeStats(stats(2));

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "2" });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#4CAF50" });
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: { 32: "icons/32_active.png", 128: "icons/128_active.png" },
    });
  });

  it("diff guard: an unchanged count is written only once", async () => {
    await applyBadgeStats(stats(2));
    await applyBadgeStats(stats(2));
    await applyBadgeStats(stats(2));

    expect(vi.mocked(chrome.action.setBadgeText).mock.calls.filter((c) => c[0].text === "2")).toHaveLength(1);
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledTimes(1); // colour set once
  });

  it("holds the badge through a single transient zero (hysteresis)", async () => {
    await applyBadgeStats(stats(2));
    vi.clearAllMocks();

    const result = await applyBadgeStats(stats(0));

    expect(result.idleConfirmed).toBe(false);
    expect(chrome.action.setBadgeText).not.toHaveBeenCalled(); // count stays "2"
    expect(chrome.action.setIcon).not.toHaveBeenCalled();
    expect(chrome.action.setTitle).not.toHaveBeenCalled(); // tooltip stays consistent with the held count
  });

  it("clears only after two consecutive zeros", async () => {
    await applyBadgeStats(stats(2));
    vi.clearAllMocks();

    await applyBadgeStats(stats(0)); // 1st zero — held
    const result = await applyBadgeStats(stats(0)); // 2nd zero — confirmed idle

    expect(result.idleConfirmed).toBe(true);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: { 32: "icons/32_download.png", 128: "icons/128_download.png" },
    });
  });

  it("a non-zero poll resets the zero streak (no premature clear)", async () => {
    await applyBadgeStats(stats(2));
    await applyBadgeStats(stats(0)); // 1st zero
    await applyBadgeStats(stats(2)); // recovers — streak reset
    vi.clearAllMocks();

    const result = await applyBadgeStats(stats(0)); // back to a *single* zero

    expect(result.idleConfirmed).toBe(false);
    expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
  });

  it("survives a worker restart: state is read from session storage, not memory", async () => {
    await applyBadgeStats(stats(3)); // badge "3" persisted to session
    vi.clearAllMocks();

    // Simulate a fresh worker: module globals would be gone, but session storage
    // (and the real toolbar) still hold "3". Two zeros must clear it, not skip it.
    await applyBadgeStats(stats(0));
    await applyBadgeStats(stats(0));

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
  });

  it("noteMonitoringFailure gives up only after ERROR_LIMIT consecutive failures", async () => {
    expect((await noteMonitoringFailure()).giveUp).toBe(false);
    expect((await noteMonitoringFailure()).giveUp).toBe(false);
    expect((await noteMonitoringFailure()).giveUp).toBe(false);
    expect((await noteMonitoringFailure()).giveUp).toBe(true); // 4th
  });

  it("a successful poll resets the failure streak", async () => {
    await noteMonitoringFailure();
    await noteMonitoringFailure();
    await applyBadgeStats(stats(1)); // success clears errorStreak

    expect((await noteMonitoringFailure()).giveUp).toBe(false); // back to 1, not 3
  });

  it("writes a formatted multiline tooltip with rates", async () => {
    await applyBadgeStats(stats(1, { downRate: 1_258_291, upRate: 419_430 }));

    const calls = vi.mocked(chrome.action.setTitle).mock.calls;
    const title = calls[calls.length - 1]?.[0].title;
    expect(title).toContain("Active: 1");
    expect(title).toContain("Total: 6");
    expect(title).toContain("Download: 1.2 MB/s");
    expect(title).toContain("Upload: 409.6 KB/s");
  });
});
