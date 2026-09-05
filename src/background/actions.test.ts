import { beforeEach, describe, expect, it, vi } from "vitest";

import { acknowledgeAttention, applyBadgeStats, markConfigurationProblem, resetActionState } from "./actions.js";

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

  it("keeps a valid NAS snapshot usable when Chrome rejects the icon repaint", async () => {
    vi.mocked(chrome.action.setIcon).mockRejectedValueOnce(new Error("action unavailable"));

    await expect(applyBadgeStats(stats(2))).resolves.toEqual({ active: 2, idleConfirmed: false });
  });

  it("diff guard: an unchanged count is written only once", async () => {
    await applyBadgeStats(stats(2));
    await applyBadgeStats(stats(2));
    await applyBadgeStats(stats(2));

    expect(vi.mocked(chrome.action.setBadgeText).mock.calls.filter((c) => c[0].text === "2")).toHaveLength(1);
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledTimes(1); // colour set once
  });

  it("clears the badge on the first successful zero — a NAS snapshot is authoritative", async () => {
    await applyBadgeStats(stats(2));
    vi.clearAllMocks();

    const result = await applyBadgeStats(stats(0));

    expect(result.idleConfirmed).toBe(true);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: { 32: "icons/32_download.png", 128: "icons/128_download.png" },
    });
  });

  it("repaints the active count after an idle period", async () => {
    await applyBadgeStats(stats(2));
    await applyBadgeStats(stats(0));
    vi.clearAllMocks();

    const result = await applyBadgeStats(stats(3));

    expect(result.idleConfirmed).toBe(false);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "3" });
  });

  it("survives a worker restart: state is read from session storage, not memory", async () => {
    await applyBadgeStats(stats(3)); // badge "3" persisted to session
    vi.clearAllMocks();

    // Simulate a fresh worker: module globals would be gone, but session storage
    // (and the real toolbar) still hold "3".
    await applyBadgeStats(stats(0));

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
  });

  it("retries rejected badge, title, and color writes on the same snapshot", async () => {
    vi.mocked(chrome.action.setBadgeText).mockRejectedValueOnce(new Error("badge unavailable"));
    vi.mocked(chrome.action.setTitle).mockRejectedValueOnce(new Error("title unavailable"));
    vi.mocked(chrome.action.setBadgeBackgroundColor).mockRejectedValueOnce(new Error("color unavailable"));

    await applyBadgeStats(stats(2));
    await applyBadgeStats(stats(2));

    expect(chrome.action.setBadgeText).toHaveBeenCalledTimes(2);
    expect(chrome.action.setTitle).toHaveBeenCalledTimes(2);
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledTimes(2);
  });

  it("does not repaint an already-red badge for repeated failures", async () => {
    await markConfigurationProblem("first failure");
    await markConfigurationProblem("second failure");

    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledTimes(1);
  });

  it("writes a formatted multiline tooltip with rates", async () => {
    await applyBadgeStats(stats(1, { downRate: 1_258_291, upRate: 419_430 }));

    const calls = vi.mocked(chrome.action.setTitle).mock.calls;
    const title = calls[calls.length - 1]?.[0].title;
    expect(title).toContain("Active: 1");
    expect(title).toContain("Total: 6");
    expect(title).toContain("Download: 1.2MB/s");
    expect(title).toContain("Upload: 410KB/s");
  });

  it("keeps an error badge red while another task is successfully active", async () => {
    await markConfigurationProblem("AddTorrent failed");
    vi.clearAllMocks();

    await applyBadgeStats(stats(1));

    expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
    expect(chrome.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
    expect(chrome.action.setTitle).not.toHaveBeenCalled();
  });

  it("keeps the failure until the popup acknowledges it, then returns the reason and clears the alarm", async () => {
    await markConfigurationProblem("Download Station rejected the torrent");
    vi.clearAllMocks();

    await expect(acknowledgeAttention()).resolves.toBe("Download Station rejected the torrent");

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
    expect(chrome.action.setTitle).toHaveBeenCalledWith({ title: "" });
    await expect(acknowledgeAttention()).resolves.toBeNull();
  });

  it("preserves unread attention when Chrome rejects its acknowledgement, then clears it on retry", async () => {
    const reason = "Download Station rejected the torrent";
    await markConfigurationProblem(reason);
    vi.clearAllMocks();
    vi.mocked(chrome.action.setBadgeText).mockRejectedValueOnce(new Error("action unavailable"));

    await expect(acknowledgeAttention()).resolves.toBe(reason);

    const afterFailedAcknowledgement = await chrome.storage.session.get("qg:toolbarState");
    expect(afterFailedAcknowledgement["qg:toolbarState"]).toEqual(
      expect.objectContaining({ badgeText: "!", failureReason: reason }),
    );

    await expect(acknowledgeAttention()).resolves.toBe(reason);
    const afterSuccessfulAcknowledgement = await chrome.storage.session.get("qg:toolbarState");
    expect(afterSuccessfulAcknowledgement["qg:toolbarState"]).toEqual(
      expect.objectContaining({ badgeText: "", failureReason: null }),
    );
  });

  it("does not let an overlapping NAS poll erase a newer red failure", async () => {
    let releaseIcon!: () => void;
    let signalIconReached!: () => void;
    const iconGate = new Promise<void>((resolve) => {
      releaseIcon = resolve;
    });
    const iconReached = new Promise<void>((resolve) => {
      signalIconReached = resolve;
    });
    vi.mocked(chrome.action.setIcon).mockImplementationOnce(async () => {
      signalIconReached();
      await iconGate;
    });

    const olderPoll = applyBadgeStats(stats(2));
    await iconReached;
    const newerFailure = markConfigurationProblem("parallel poll failure");
    await Promise.resolve();
    await Promise.resolve();
    releaseIcon();
    await Promise.all([olderPoll, newerFailure]);

    const stored = await chrome.storage.session.get("qg:toolbarState");
    expect(stored["qg:toolbarState"]).toEqual(expect.objectContaining({ badgeText: "!", failureRevision: 1 }));
  });
});
