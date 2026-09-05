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

  it("formats sizeText for in-progress vs completed tasks", () => {
    // In-progress: "900.0 MB / 1.9 GB" (scaleBytes 900M -> 858.3 MB, 2G -> 1.9 GB)
    const activeView = getDownloadItemView(makeTask({
      status: "downloading",
      downloadedBytes: 900_000_000,
      sizeBytes: 2_000_000_000,
    }));
    expect(activeView.sizeText).toBe("858.3 MB / 1.9 GB");

    // Completed: full download shows total size
    const completedView = getDownloadItemView(makeTask({
      status: "finished",
      downloadedBytes: 2_000_000_000,
      sizeBytes: 2_000_000_000,
    }));
    expect(completedView.sizeText).toBe("1.9 GB");

    // Completed: selective download shows actual downloaded volume
    const selectiveCompleted = getDownloadItemView(makeTask({
      status: "finished",
      downloadedBytes: 2_200_000_000,
      sizeBytes: 22_600_000_000,
    }));
    expect(selectiveCompleted.sizeText).toBe("2.0 GB");

    // Zero total size with positive downloaded bytes
    const unknownTotalView = getDownloadItemView(makeTask({
      sizeBytes: 0,
      downloadedBytes: 500_000_000,
    }));
    expect(unknownTotalView.sizeText).toBe("476.8 MB");

    // Zero size & zero downloaded
    const unknownView = getDownloadItemView(makeTask({
      sizeBytes: 0,
      downloadedBytes: 0,
    }));
    expect(unknownView.sizeText).toBe("");
  });

  it("formats swarmText for active torrents, seeding, and finished", () => {
    // Active download with seeds & peers (objects)
    const activeObjView = getDownloadItemView(makeTask({
      status: "downloading",
      seeds: { connected: 15, total: 30 },
      peers: { connected: 5, total: 10 },
    }));
    expect(activeObjView.swarmText).toBe("S15 P5");

    // Active download with zeros
    const zeroSwarm = getDownloadItemView(makeTask({
      status: "downloading",
      seeds: { connected: 0 },
      peers: { connected: 0 },
    }));
    expect(zeroSwarm.swarmText).toBe("S0 P0");

    // Active download with seeds undefined and peers present: only P is shown (not fake S0)
    const peersOnly = getDownloadItemView(makeTask({
      status: "downloading",
      seeds: undefined,
      peers: { connected: 4 },
    }));
    expect(peersOnly.swarmText).toBe("P4");

    // Seeding: peers connected > 0
    const seedingView = getDownloadItemView(makeTask({
      status: "seeding",
      seeds: { connected: 0 },
      peers: { connected: 4 },
    }));
    expect(seedingView.swarmText).toBe("P4");

    // Seeding: peers connected = 0 (actively seeding, 0 leechers)
    const seedingZero = getDownloadItemView(makeTask({
      status: "seeding",
      peers: { connected: 0 },
    }));
    expect(seedingZero.swarmText).toBe("P0");

    // Seeding: peers unknown (undefined)
    const seedingUnknown = getDownloadItemView(makeTask({
      status: "seeding",
      peers: undefined,
    }));
    expect(seedingUnknown.swarmText).toBe("");

    // Queued or checking: swarm telemetry suppressed
    const queuedView = getDownloadItemView(makeTask({
      status: "queued",
      seeds: { connected: 10 },
      peers: { connected: 5 },
    }));
    expect(queuedView.swarmText).toBe("");

    // Finished or paused: swarm telemetry hidden
    const finishedView = getDownloadItemView(makeTask({
      status: "finished",
      seeds: { connected: 10 },
      peers: { connected: 5 },
    }));
    expect(finishedView.swarmText).toBe("");
  });

  it("formats error taxonomy for QNAP error codes and messages", () => {
    // Disk full
    const diskFullView = getDownloadItemView(makeTask({
      status: "error",
      errorCode: 20488,
    }));
    expect(diskFullView.errorDetail).toBe("Not enough disk space on NAS");

    // Duplicate
    const duplicateView = getDownloadItemView(makeTask({
      status: "error",
      errorCode: 8196,
    }));
    expect(duplicateView.errorDetail).toBe("Torrent already added on NAS");

    // Folder missing
    const folderView = getDownloadItemView(makeTask({
      status: "error",
      errorCode: 4096,
    }));
    expect(folderView.errorDetail).toBe("Destination folder not found");

    // Explicit error message
    const customView = getDownloadItemView(makeTask({
      status: "error",
      errorMessage: "Connection timed out",
    }));
    expect(customView.errorDetail).toBe("Connection timed out");

    // Unknown error code fallback
    const unknownView = getDownloadItemView(makeTask({
      status: "error",
      errorCode: 99999,
    }));
    expect(unknownView.errorDetail).toBe("Error 99999");

    // Generic error fallback
    const fallbackView = getDownloadItemView(makeTask({
      status: "error",
    }));
    expect(fallbackView.errorDetail).toBe("Download failed");
  });
});

