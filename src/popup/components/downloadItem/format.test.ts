import type { Task } from "@lib/tasks.js";
import { describe, expect, it } from "vitest";
import { getDownloadItemView } from "./format.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    name: "Ubuntu Linux 24.04",
    status: "downloading",
    progress: 45,
    sizeBytes: 2_000_000_000,
    downloadedBytes: 900_000_000,
    uploadedBytes: 150_000_000,
    downSpeedBps: 5_242_880, // 5 MB/s
    upSpeedBps: 1_048_576, // 1 MB/s
    shareRatio: 0.17,
    etaSec: 220,
    seeds: { connected: 15, total: 30 },
    peers: { connected: 5, total: 10 },
    addedAt: 1700000000000,
    ...overrides,
  };
}

describe("getDownloadItemView", () => {
  it("computes active downloading item view", () => {
    const task = makeTask();
    const view = getDownloadItemView(task);

    expect(view.hash).toBe("task-1");
    expect(view.statusLabel).toBe("Downloading");
    expect(view.isDownloadComplete).toBe(false);
    expect(view.progress).toBe(45);
    expect(view.progressVariant).toBe("active");
    expect(view.downloadSpeedText).toBe("5.0 MB/s");
    expect(view.uploadSpeedText).toBe("1.0 MB/s");
    expect(view.uploadedText).toBe("143.1 MB");
    expect(view.ratioText).toBe("0.17");
    expect(view.etaText).toBe("3m 40s");
    expect(view.speedLabel).toContain("Download speed 5.0 MB/s");
    expect(view.speedLabel).toContain("ETA 3m 40s");
  });

  it("handles seeding task view with quota progress and ETA", () => {
    const task = makeTask({
      status: "seeding",
      progress: 25,
      downSpeedBps: 0,
      upSpeedBps: 2_097_152, // 2 MB/s
      etaSec: 1341,
      shareRatio: 0.25,
    });
    const view = getDownloadItemView(task);

    expect(view.statusLabel).toBe("Seeding");
    expect(view.isDownloadComplete).toBe(true);
    expect(view.progressVariant).toBe("seeding");
    expect(view.progress).toBe(25);
    expect(view.etaText).toBe("22m 21s");
    expect(view.ratioText).toBe("0.25");
    expect(view.speedLabel).toContain("Uploaded");
    expect(view.speedLabel).toContain("ratio 0.25");
    expect(view.speedLabel).toContain("upload speed 2.0 MB/s");
    expect(view.speedLabel).toContain("seeding ETA 22m 21s");
  });

  it("handles finished task view with complete 100% progress and no ETA", () => {
    const task = makeTask({
      status: "finished",
      progress: 100,
      downSpeedBps: 0,
      upSpeedBps: 0,
      etaSec: 0,
      shareRatio: 1.5,
    });
    const view = getDownloadItemView(task);

    expect(view.statusLabel).toBe("Finished");
    expect(view.isDownloadComplete).toBe(true);
    expect(view.progressVariant).toBe("complete");
    expect(view.progress).toBe(100);
    expect(view.etaText).toBe("");
  });

  it("handles error task view", () => {
    const task = makeTask({
      status: "error",
      progress: 10,
    });
    const view = getDownloadItemView(task);

    expect(view.statusLabel).toBe("Error");
    expect(view.progressVariant).toBe("error");
  });

  it("formats ETA for seconds, minutes, and hours", () => {
    // Under 1 minute
    const shortView = getDownloadItemView(makeTask({ etaSec: 45 }));
    expect(shortView.etaText).toBe("45s");

    // Minutes and seconds
    const minView = getDownloadItemView(makeTask({ etaSec: 130 }));
    expect(minView.etaText).toBe("2m 10s");

    // Hours, minutes, and seconds
    const hourView = getDownloadItemView(makeTask({ etaSec: 3665 }));
    expect(hourView.etaText).toBe("1h 1m 5s");

    // Zero or negative
    const zeroView = getDownloadItemView(makeTask({ etaSec: 0 }));
    expect(zeroView.etaText).toBe("");
  });

  it("scales bytes across B, KB, MB, GB, TB", () => {
    expect(getDownloadItemView(makeTask({ uploadedBytes: 0 })).uploadedText).toBe("0 B");
    expect(getDownloadItemView(makeTask({ uploadedBytes: 500 })).uploadedText).toBe("500 B");
    expect(getDownloadItemView(makeTask({ uploadedBytes: 1024 })).uploadedText).toBe("1.0 KB");
    expect(getDownloadItemView(makeTask({ uploadedBytes: 1024 * 1024 })).uploadedText).toBe("1.0 MB");
    expect(getDownloadItemView(makeTask({ uploadedBytes: 1024 * 1024 * 1024 })).uploadedText).toBe("1.0 GB");
    expect(getDownloadItemView(makeTask({ uploadedBytes: 1024 * 1024 * 1024 * 1024 * 2 })).uploadedText).toBe("2.0 TB");
  });

  it("handles fallback status labels for unlisted statuses", () => {
    const view = getDownloadItemView(makeTask({ status: "customStatus" as any }));
    expect(view.statusLabel).toBe("CustomStatus");
  });

  it("clamps progress between 0 and 100", () => {
    expect(getDownloadItemView(makeTask({ progress: -10 })).progress).toBe(0);
    expect(getDownloadItemView(makeTask({ progress: 150 })).progress).toBe(100);
  });
});
