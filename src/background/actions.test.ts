import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateStatsBadge } from "./actions.js";

describe("updateStatsBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the active-task count on the badge", () => {
    updateStatsBadge({ active: 2, all: 6, downRate: 0, upRate: 0 });

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "2" });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#4CAF50" });
  });

  it("clears the badge text when nothing is active", () => {
    updateStatsBadge({ active: 0, all: 6, downRate: 0, upRate: 0 });

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
  });

  it("writes a formatted multiline tooltip with rates", () => {
    updateStatsBadge({ active: 1, all: 6, downRate: 1_258_291, upRate: 419_430 });

    const calls = vi.mocked(chrome.action.setTitle).mock.calls;
    const title = calls[calls.length - 1]?.[0].title;
    expect(title).toContain("Active: 1");
    expect(title).toContain("Total: 6");
    expect(title).toContain("Download: 1.2 MB/s");
    expect(title).toContain("Upload: 409.6 KB/s");
  });
});
