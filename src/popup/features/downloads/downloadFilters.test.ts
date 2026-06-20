import { describe, expect, it } from "vitest";

import type { Task } from "@lib/tasks.js";
import { filterDownloads, isCompleted, isInProgress } from "./downloadFilters.js";

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
});
