import { describe, expect, it } from "vitest";

import type { Task } from "@lib/tasks.js";
import { filterDownloads, isCompleted, isInProgress, reorderTasks } from "./downloadFilters.js";

const task = (name: string, status: Task["status"]): Task => ({
  id: name,
  name,
  status,
  progress: 0,
  sizeBytes: 0,
  downloadedBytes: 0,
  uploadedBytes: 0,
  downSpeedBps: 0,
  upSpeedBps: 0,
});

describe("downloadFilters", () => {
  it("separates working tasks from completed, stopped, and failed tasks", () => {
    expect(isInProgress("downloading")).toBe(true);
    expect(isInProgress("seeding")).toBe(true);
    expect(isInProgress("paused")).toBe(true);
    expect(isInProgress("stopped")).toBe(false);
    expect(isInProgress("error")).toBe(false);
    expect(isCompleted("finished")).toBe(true);
    expect(isCompleted("seeding")).toBe(true);
  });

  it("filters task names case-insensitively within the selected status group", () => {
    const tasks = [
      task("Ubuntu ISO", "downloading"),
      task("Fedora ISO", "finished"),
      task("Broken archive", "error"),
    ];

    expect(filterDownloads(tasks, "in-progress", "ubuntu")).toEqual([tasks[0]]);
    expect(filterDownloads(tasks, "completed", "ISO")).toEqual([tasks[1]]);
    expect(filterDownloads(tasks, "all", "archive")).toEqual([tasks[2]]);
  });

  describe("reorderTasks", () => {
    const t1 = task("Task 1", "downloading");
    const t2 = task("Task 2", "queued");
    const t3 = task("Task 3", "downloading");

    it("moves task to top", () => {
      const reordered = reorderTasks([t1, t2, t3], "Task 3", "top");
      expect(reordered.map((t) => t.id)).toEqual(["Task 3", "Task 1", "Task 2"]);
    });

    it("moves task up", () => {
      const reordered = reorderTasks([t1, t2, t3], "Task 2", "up");
      expect(reordered.map((t) => t.id)).toEqual(["Task 2", "Task 1", "Task 3"]);
    });

    it("moves task down", () => {
      const reordered = reorderTasks([t1, t2, t3], "Task 1", "down");
      expect(reordered.map((t) => t.id)).toEqual(["Task 2", "Task 1", "Task 3"]);
    });

    it("does nothing when moving top task up or bottom task down", () => {
      expect(reorderTasks([t1, t2, t3], "Task 1", "up").map((t) => t.id)).toEqual(["Task 1", "Task 2", "Task 3"]);
      expect(reorderTasks([t1, t2, t3], "Task 3", "down").map((t) => t.id)).toEqual(["Task 1", "Task 2", "Task 3"]);
    });

    it("ignores unknown hash", () => {
      expect(reorderTasks([t1, t2, t3], "unknown", "top")).toEqual([t1, t2, t3]);
    });
  });
});
