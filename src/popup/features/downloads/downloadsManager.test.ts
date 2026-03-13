import { beforeEach, describe, expect, it, vi } from "vitest";

const sharedApiMock = vi.hoisted(() => ({
  getApiClient: vi.fn(),
  invalidateClientCache: vi.fn(),
}));

vi.mock("../../shared/api", () => sharedApiMock);

import {
  abortListDownloads,
  listDownloads,
  pauseTorrent,
} from "./downloadsManager.js";
import { getSnapshot, updateSnapshot } from "./downloadsState.js";
import type { Task } from "@lib/tasks.js";

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    hash: "hash-1",
    name: "Ubuntu ISO",
    status: "downloading",
    progress: 10,
    sizeBytes: 100,
    downloadedBytes: 10,
    uploadedBytes: 0,
    downSpeedBps: 25,
    upSpeedBps: 5,
    source: "qnap",
    ...overrides,
  };
}

describe("downloadsManager", () => {
  beforeEach(() => {
    abortListDownloads();
    updateSnapshot({ hashes: new Set(), names: new Set() });
    sharedApiMock.getApiClient.mockReset();
  });

  it("skips overlapping download list requests", async () => {
    let resolveQuery!: (value: { raw: { error: number; data: unknown[] }; tasks: Task[] }) => void;

    const queryTasks = vi.fn(
      () =>
        new Promise<{ raw: { error: number; data: unknown[] }; tasks: Task[] }>((resolve) => {
          resolveQuery = resolve;
        })
    );

    sharedApiMock.getApiClient.mockResolvedValue({ queryTasks } as never);

    const first = listDownloads();
    await flushMicrotasks();
    const second = await listDownloads();

    expect(second).toEqual({ skipped: true });

    resolveQuery({
      raw: { error: 0, data: [] },
      tasks: [],
    });

    await expect(first).resolves.toMatchObject({ skipped: false, tasks: [] });
    expect(queryTasks).toHaveBeenCalledTimes(1);
  });

  it("updates the duplicate-check snapshot from raw API data", async () => {
    const task = createTask({ hash: "ABC123", name: "Movie.Release.2026" });

    sharedApiMock.getApiClient.mockResolvedValue({
      queryTasks: vi.fn().mockResolvedValue({
        raw: {
          error: 0,
          data: [{ hash: "ABC123", name: "Movie.Release.2026.torrent" }],
        },
        tasks: [task],
      }),
    } as never);

    const result = await listDownloads();
    const snapshot = getSnapshot();

    expect(result).toMatchObject({ skipped: false, tasks: [task] });
    expect(snapshot.hashes.has("abc123")).toBe(true);
    expect(snapshot.names.has("movie release 2026")).toBe(true);
  });

  it("aborts an in-flight query and clears the lock for the next refresh", async () => {
    const queryTasks = vi.fn(({ signal }: { signal: AbortSignal }) => {
      return new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    });

    sharedApiMock.getApiClient.mockResolvedValueOnce({ queryTasks } as never);

    const pending = listDownloads();
    await flushMicrotasks();
    abortListDownloads();

    await expect(pending).rejects.toThrow(/aborted/i);

    const nextQuery = vi.fn().mockResolvedValue({
      raw: { error: 0, data: [] },
      tasks: [],
    });
    sharedApiMock.getApiClient.mockResolvedValueOnce({ queryTasks: nextQuery } as never);

    await expect(listDownloads()).resolves.toMatchObject({ skipped: false, tasks: [] });
    expect(nextQuery).toHaveBeenCalledTimes(1);
  });

  it("falls back to stopTask when pauseTask is unavailable", async () => {
    const stopTask = vi.fn().mockResolvedValue(true);

    sharedApiMock.getApiClient.mockResolvedValue({ stopTask } as never);

    await pauseTorrent("hash-123");

    expect(stopTask).toHaveBeenCalledWith("hash-123");
  });
});



