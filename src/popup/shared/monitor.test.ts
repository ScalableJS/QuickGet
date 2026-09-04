import type { ProgressSummary } from "@lib/tasks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MONITOR_MESSAGE, SNAPSHOT_MESSAGE } from "@/background/monitorMessage";
import { requestMonitoring, sendBadgeSnapshot } from "./monitor";

describe("monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends MONITOR_MESSAGE via chrome.runtime.sendMessage", () => {
    requestMonitoring();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: MONITOR_MESSAGE,
    });
  });

  it("sends SNAPSHOT_MESSAGE with stats via chrome.runtime.sendMessage", () => {
    const stats: ProgressSummary = {
      active: 2,
      all: 3,
      downRate: 1024,
      upRate: 512,
    };

    sendBadgeSnapshot(stats);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: SNAPSHOT_MESSAGE,
      stats,
    });
  });

  it("safely handles sendMessage synchronous throw and rejected promise", () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(() => {
      throw new Error("Runtime unavailable");
    });
    expect(() => requestMonitoring()).not.toThrow();

    vi.mocked(chrome.runtime.sendMessage).mockReturnValueOnce(
      Promise.reject(new Error("Receiver missing")) as unknown as ReturnType<typeof chrome.runtime.sendMessage>,
    );
    expect(() => requestMonitoring()).not.toThrow();
  });
});
