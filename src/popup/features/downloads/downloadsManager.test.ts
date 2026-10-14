import { beforeEach, describe, expect, it, vi } from "vitest";

const sharedApiMock = vi.hoisted(() => ({
  getApiClient: vi.fn(),
  invalidateClientCache: vi.fn(),
}));

vi.mock("../../shared/api", () => sharedApiMock);

import type { Task } from "@lib/tasks.js";
import {
  PauseFallbackStopError,
  abortListDownloads,
  listDownloads,
  pauseTorrent,
  setTaskPriority,
} from "./downloadsManager.js";

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
    sharedApiMock.getApiClient.mockReset();
  });

  it("skips overlapping download list requests", async () => {
    let resolveQuery!: (value: { raw: { error: number; data: unknown[] }; tasks: Task[] }) => void;

    const queryTasks = vi.fn(
      () =>
        new Promise<{ raw: { error: number; data: unknown[] }; tasks: Task[] }>((resolve) => {
          resolveQuery = resolve;
        }),
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

  it("aborts an in-flight query and clears the lock for the next refresh", async () => {
    const queryTasks = vi.fn(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        }),
    );

    sharedApiMock.getApiClient.mockResolvedValueOnce({ queryTasks } as never);

    const pending = listDownloads();
    await flushMicrotasks();
    abortListDownloads();

    await expect(pending).resolves.toEqual({ skipped: true });

    const nextQuery = vi.fn().mockResolvedValue({
      raw: { error: 0, data: [] },
      tasks: [],
    });
    sharedApiMock.getApiClient.mockResolvedValueOnce({ queryTasks: nextQuery } as never);

    await expect(listDownloads()).resolves.toMatchObject({ skipped: false, tasks: [] });
    expect(nextQuery).toHaveBeenCalledTimes(1);
  });

  it("discards a stale completion after an abort and replacement query", async () => {
    let resolveFirst!: (value: { raw: { error: number; data: unknown[] }; tasks: Task[] }) => void;
    const firstQuery = vi.fn(
      () =>
        new Promise<{ raw: { error: number; data: unknown[] }; tasks: Task[] }>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const replacement = createTask({ hash: "replacement", name: "Replacement" });
    const secondQuery = vi.fn().mockResolvedValue({
      raw: { error: 0, data: [{ hash: "replacement", name: "Replacement" }] },
      tasks: [replacement],
    });
    sharedApiMock.getApiClient.mockResolvedValueOnce({ queryTasks: firstQuery } as never).mockResolvedValueOnce({
      queryTasks: secondQuery,
    } as never);

    const first = listDownloads();
    await flushMicrotasks();
    abortListDownloads();
    const second = listDownloads();
    await expect(second).resolves.toMatchObject({ skipped: false, tasks: [replacement] });
    resolveFirst({
      raw: { error: 0, data: [{ hash: "stale", name: "Stale" }] },
      tasks: [createTask({ hash: "stale", name: "Stale" })],
    });

    await expect(first).resolves.toEqual({ skipped: true });
  });

  it("discards a stale rejection after an abort", async () => {
    let rejectFirst!: (reason: Error) => void;
    const queryTasks = vi.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
          rejectFirst = reject;
        }),
    );
    const replacementQuery = vi.fn().mockResolvedValue({ raw: { error: 0, data: [] }, tasks: [] });
    sharedApiMock.getApiClient.mockResolvedValueOnce({ queryTasks } as never).mockResolvedValueOnce({
      queryTasks: replacementQuery,
    } as never);

    const first = listDownloads();
    await flushMicrotasks();
    abortListDownloads();
    const replacement = listDownloads();
    await expect(replacement).resolves.toMatchObject({ skipped: false, tasks: [] });
    rejectFirst(new Error("late network failure"));

    await expect(first).resolves.toEqual({ skipped: true });
  });

  it("falls back to stopTask when the NAS lacks Task/Pause (apiUnsupported)", async () => {
    const stopTask = vi.fn().mockResolvedValue(true);
    const pauseTask = vi.fn().mockRejectedValue(Object.assign(new Error("no such api"), { apiUnsupported: true }));

    sharedApiMock.getApiClient.mockResolvedValue({ pauseTask, stopTask } as never);

    await expect(pauseTorrent("hash-123")).resolves.toBe("stopped");

    expect(pauseTask).toHaveBeenCalledWith("hash-123");
    expect(stopTask).toHaveBeenCalledWith("hash-123");
  });

  it("surfaces a pauseTask failure that is not apiUnsupported", async () => {
    const stopTask = vi.fn().mockResolvedValue(true);
    const pauseTask = vi.fn().mockRejectedValue(new Error("network down"));

    sharedApiMock.getApiClient.mockResolvedValue({ pauseTask, stopTask } as never);

    await expect(pauseTorrent("hash-123")).rejects.toThrow(/network down/);
    expect(stopTask).not.toHaveBeenCalled();
  });

  it("reports a native Pause acceptance as paused", async () => {
    const pauseTask = vi.fn().mockResolvedValue(true);
    sharedApiMock.getApiClient.mockResolvedValue({ pauseTask } as never);

    await expect(pauseTorrent("hash-123")).resolves.toBe("paused");
  });

  it("surfaces a rejected Stop fallback when Pause is unsupported", async () => {
    const pauseTask = vi.fn().mockRejectedValue(Object.assign(new Error("no such api"), { apiUnsupported: true }));
    const stopTask = vi.fn().mockRejectedValue(new Error("Stop task failed"));
    sharedApiMock.getApiClient.mockResolvedValue({ pauseTask, stopTask } as never);

    await expect(pauseTorrent("hash-123")).rejects.toBeInstanceOf(PauseFallbackStopError);
    expect(stopTask).toHaveBeenCalledWith("hash-123");
  });

  it("retains stop fallback context when the fallback transport rejects", async () => {
    const pauseTask = vi.fn().mockRejectedValue(Object.assign(new Error("no such api"), { apiUnsupported: true }));
    const stopTask = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    sharedApiMock.getApiClient.mockResolvedValue({ pauseTask, stopTask } as never);

    await expect(pauseTorrent("hash-123")).rejects.toMatchObject({
      name: "PauseFallbackStopError",
      stopError: expect.objectContaining({ message: "Failed to fetch" }),
    });
    expect(pauseTask).toHaveBeenCalledTimes(1);
    expect(stopTask).toHaveBeenCalledTimes(1);
  });

  it("delegates setTaskPriority to api client", async () => {
    const clientSetPriority = vi.fn().mockResolvedValue(undefined);
    sharedApiMock.getApiClient.mockResolvedValue({ setTaskPriority: clientSetPriority } as never);

    await setTaskPriority("hash-top", "top");

    expect(clientSetPriority).toHaveBeenCalledWith("hash-top", "top");
  });
});
