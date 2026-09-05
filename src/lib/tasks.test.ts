import { describe, expect, it } from "vitest";

import { normalizeTasks, type TaskStatus } from "./tasks.js";

describe("QNAP task status contract", () => {
  // Official mapping read from DS.TASK_STATUS in Download Station 5.10.2's installed
  // opt/www/libs/ds-all.js; labels are defined by the adjacent lang/ENG.js artifact.
  it.each([
    [0, "queued"],
    [1, "paused"],
    [2, "stopped"],
    [3, "moving"],
    [4, "error"],
    [5, "finished"],
    [100, "seeding"],
    [101, "queuedChecking"],
    [102, "checking"],
    [103, "downloadingMetadata"],
    [104, "downloading"],
    [105, "allocating"],
  ] satisfies [number, TaskStatus][])("maps Download Station state %i to %s", (state, expected) => {
    const [task] = normalizeTasks("qnap", {
      data: [{ hash: `state-${state}`, source_name: `state-${state}`, state, progress: 42, size: 100 }],
    });

    expect(task?.status).toBe(expected);
  });

  it("preserves the real download completion chain", () => {
    const statuses = [104, 3, 100].map(
      (state) =>
        normalizeTasks("qnap", { data: [{ hash: String(state), source_name: String(state), state }] })[0]?.status,
    );

    expect(statuses).toEqual(["downloading", "moving", "seeding"]);
  });

  describe("QNAP task metrics and edge cases", () => {
    it("calculates progress from downloaded and total size, clamped to 0..100", () => {
      const [normal] = normalizeTasks("qnap", {
        data: [{ hash: "1", source_name: "T1", size: 1000, down_size: 250 }],
      });
      expect(normal?.progress).toBe(25);

      const [overflow] = normalizeTasks("qnap", {
        data: [{ hash: "2", source_name: "T2", size: 500, down_size: 1500 }],
      });
      expect(overflow?.progress).toBe(100);

      const [zeroSize] = normalizeTasks("qnap", {
        data: [{ hash: "3", source_name: "T3", size: 0, progress: 42 }],
      });
      expect(zeroSize?.progress).toBe(42);
    });

    it("parses dates, seeds, peers, and speeds correctly", () => {
      const [task] = normalizeTasks("qnap", {
        data: [
          {
            hash: "HASH123",
            source_name: "Ubuntu ISO",
            size: 2_000_000,
            down_size: 1_000_000,
            up_size: 500_000,
            down_rate: 102400,
            up_rate: 51200,
            seeds: 45,
            peers: 12,
            eta: 3600,
            create_time: "2026-02-19T16:41:55",
            share: 0.5,
          },
        ],
      });

      expect(task).toMatchObject({
        id: "HASH123",
        name: "Ubuntu ISO",
        sizeBytes: 2_000_000,
        downloadedBytes: 1_000_000,
        uploadedBytes: 500_000,
        downSpeedBps: 102400,
        upSpeedBps: 51200,
        seeds: { connected: 45, total: undefined },
        peers: { connected: 12, total: undefined },
        etaSec: 3600,
        shareRatio: 0.5,
      });
      expect(typeof task?.addedAt).toBe("number");
    });

    it("handles fallback date formats in parseDateToEpoch", () => {
      const [task1] = normalizeTasks("qnap", {
        data: [{ hash: "1", source_name: "T1", create_time: "2026-05-10T12:00:00" }],
      });
      expect(typeof task1?.addedAt).toBe("number");

      const [task2] = normalizeTasks("qnap", {
        data: [{ hash: "2", source_name: "T2", create_time: "invalid-date" }],
      });
      expect(task2?.addedAt).toBeUndefined();
    });

    it("handles missing names and identifiers gracefully", () => {
      const [task] = normalizeTasks("qnap", {
        data: [{ state: 0 }],
      });

      expect(task?.id).toBeDefined();
      expect(task?.name).toBe("task");
    });

    it("extracts errorCode and errorMessage from QNAP task payload and ignores 0", () => {
      const [diskFull] = normalizeTasks("qnap", {
        data: [{ hash: "1", source_name: "Disk Full", state: 4, error: 20488, error_msg: "Not enough disk space" }],
      });
      expect(diskFull?.errorCode).toBe(20488);
      expect(diskFull?.errorMessage).toBe("Not enough disk space");

      const [normalTask] = normalizeTasks("qnap", {
        data: [{ hash: "2", source_name: "Normal", state: 104, error: 0 }],
      });
      expect(normalTask?.errorCode).toBeUndefined();
      expect(normalTask?.errorMessage).toBeUndefined();
    });

    it("normalizes downloadedBytes from done, down_size, or total_down", () => {
      const [doneTask] = normalizeTasks("qnap", {
        data: [{ hash: "1", source_name: "T1", done: 500_000 }],
      });
      expect(doneTask?.downloadedBytes).toBe(500_000);

      const [downSizeTask] = normalizeTasks("qnap", {
        data: [{ hash: "2", source_name: "T2", down_size: 750_000 }],
      });
      expect(downSizeTask?.downloadedBytes).toBe(750_000);

      const [totalDownTask] = normalizeTasks("qnap", {
        data: [{ hash: "3", source_name: "T3", total_down: 1_250_000 }],
      });
      expect(totalDownTask?.downloadedBytes).toBe(1_250_000);
    });

    it("returns empty array for invalid or empty input structures", () => {
      expect(normalizeTasks("qnap", null)).toEqual([]);
      expect(normalizeTasks("qnap", undefined)).toEqual([]);
      expect(normalizeTasks("qnap", {})).toEqual([]);
      expect(normalizeTasks("qnap", { data: "not an array" })).toEqual([]);
      expect(normalizeTasks("qnap", { data: [] })).toEqual([]);
    });
  });

  describe("Synology task normalization contract", () => {
    it("normalizes a rich Synology task payload", () => {
      const synologyPayload = {
        tasks: [
          {
            id: "dbid_42",
            title: "ArchLinux.iso",
            status: "downloading",
            size: 1000,
            additional: {
              transfer: {
                size_downloaded: 400,
                size_uploaded: 150,
                speed_download: 50000,
                speed_upload: 10000,
                eta: 120,
              },
              detail: {
                destination: "Downloads/Linux",
                connected_seeders: 10,
                seeders: 25,
                connected_leechers: 3,
                leechers: 8,
                create_time: 1700000000,
              },
            },
          },
        ],
      };

      const [task] = normalizeTasks("synology", synologyPayload);

      expect(task).toMatchObject({
        id: "dbid_42",
        name: "ArchLinux.iso",
        status: "downloading",
        progress: 40,
        sizeBytes: 1000,
        downloadedBytes: 400,
        uploadedBytes: 150,
        downSpeedBps: 50000,
        upSpeedBps: 10000,
        etaSec: 120,
        addedAt: 1700000000,
        seeds: { connected: 10, total: 25 },
        peers: { connected: 3, total: 8 },
      });
    });

    it("maps Synology statuses correctly", () => {
      const statuses = ["downloading", "waiting", "paused", "finished", "error", "seeding"].map(
        (status) => normalizeTasks("synology", { tasks: [{ id: "1", title: "T", status }] })[0]?.status,
      );

      expect(statuses).toEqual(["downloading", "queued", "paused", "finished", "error", "seeding"]);
    });
  });
});
