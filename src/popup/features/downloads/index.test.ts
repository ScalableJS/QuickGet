import { beforeEach, describe, expect, it, vi } from "vitest";

const statusMock = vi.hoisted(() => ({ clearStatus: vi.fn(), showStatus: vi.fn() }));
const managerMock = vi.hoisted(() => ({
  PauseFallbackStopError: class PauseFallbackStopError extends Error {
    readonly stopError: unknown;

    constructor(stopError: unknown) {
      super();
      this.stopError = stopError;
    }
  },
  abortListDownloads: vi.fn(),
  listDownloads: vi.fn(),
  pauseTorrent: vi.fn(),
  removeDownload: vi.fn(),
  startTorrent: vi.fn(),
  stopTorrent: vi.fn(),
}));
const stateMock = vi.hoisted(() => ({
  clearSelection: vi.fn(),
  getSelectedHash: vi.fn(),
  onSelectionChange: vi.fn(() => () => {}),
}));
const uiMock = vi.hoisted(() => ({
  hideDownloads: vi.fn(),
  renderDownloads: vi.fn(),
  setRemovingDownload: vi.fn(),
  setupDownloadsUI: vi.fn(),
}));

vi.mock("@/popup/components", () => statusMock);
const monitorMock = vi.hoisted(() => ({ requestMonitoring: vi.fn(), sendBadgeSnapshot: vi.fn() }));

vi.mock("../../shared/monitor.js", () => monitorMock);
vi.mock("./autoRefresh.js", () => ({
  configureAutoRefresh: vi.fn(),
  startAutoRefresh: vi.fn(),
  stopAutoRefresh: vi.fn(),
}));
vi.mock("./downloadsManager.js", () => managerMock);
vi.mock("./downloadsState.js", () => stateMock);
vi.mock("./downloadsUI.js", () => uiMock);

import { initializeDownloads } from "./index.js";

async function initializeFeature() {
  managerMock.listDownloads.mockResolvedValue({ skipped: false, raw: { error: 0, data: [] }, tasks: [] });
  return initializeDownloads();
}

describe("downloads feature terminal feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    managerMock.listDownloads.mockReset();
  });

  it.each([
    ["start", "startTorrent", "Start task failed", "Failed to start download: Start task failed"],
    ["stop", "stopTorrent", "Stop task failed", "Failed to stop download: Stop task failed"],
    ["pause", "pauseTorrent", "Pause task failed", "Failed to pause download: Pause task failed"],
  ] as const)("reports a rejected %s command once without rejecting its caller", async (action, managerMethod, failure, message) => {
    managerMock[managerMethod].mockRejectedValue(new Error(failure));
    const feature = await initializeFeature();

    await expect(feature[action]("task-1")).resolves.toBeUndefined();

    expect(statusMock.showStatus).toHaveBeenLastCalledWith(message, "error");
  });

  it("keeps the latest overlapping command outcome", async () => {
    let resolveStart!: () => void;
    managerMock.startTorrent.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStart = resolve;
        }),
    );
    managerMock.stopTorrent.mockResolvedValue(undefined);
    const feature = await initializeFeature();

    const starting = feature.start("task-1");
    await Promise.resolve();
    await feature.stop("task-1");
    resolveStart();
    await starting;

    expect(statusMock.showStatus).toHaveBeenLastCalledWith("Download stopped", "success", { autoHideMs: 2000 });
    expect(statusMock.showStatus).not.toHaveBeenCalledWith("Download started", "success", { autoHideMs: 2000 });
  });

  it("reports a successful unsupported Pause fallback as stopped", async () => {
    managerMock.pauseTorrent.mockResolvedValue("stopped");
    const feature = await initializeFeature();

    await feature.pause("task-1");

    expect(statusMock.showStatus).toHaveBeenLastCalledWith("Download stopped", "success", { autoHideMs: 2000 });
  });

  it("keeps an accepted remove distinct from a failed list refresh", async () => {
    managerMock.removeDownload.mockResolvedValue(undefined);
    managerMock.listDownloads
      .mockResolvedValueOnce({ skipped: false, raw: { error: 0, data: [] }, tasks: [] })
      .mockRejectedValueOnce(new Error("refresh failed"));
    const feature = await initializeFeature();

    await feature.remove("task-1");

    expect(statusMock.showStatus).toHaveBeenLastCalledWith("Download removed, but failed to refresh the list", "error");
  });

  it("keeps a rejected remove retryable", async () => {
    managerMock.removeDownload.mockRejectedValueOnce(new Error("Remove task failed")).mockResolvedValueOnce(undefined);
    managerMock.listDownloads.mockResolvedValue({ skipped: false, raw: { error: 0, data: [] }, tasks: [] });
    const feature = await initializeFeature();

    await feature.remove("task-1");
    await feature.remove("task-1");

    expect(managerMock.removeDownload).toHaveBeenCalledTimes(2);
    expect(statusMock.showStatus).toHaveBeenLastCalledWith("Download removed", "success", { autoHideMs: 2000 });
  });

  it("invalidates pending work, rows, and selection when the connection changes", async () => {
    let resolveReplacement!: (result: {
      skipped: false;
      raw: { error: number; data: [] };
      tasks: { hash: string }[];
    }) => void;
    managerMock.listDownloads
      .mockResolvedValueOnce({ skipped: false, raw: { error: 0, data: [] }, tasks: [] })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveReplacement = resolve;
          }),
      );
    const feature = await initializeFeature();

    statusMock.clearStatus.mockClear();
    feature.connectionChanged();
    expect(statusMock.clearStatus).toHaveBeenCalledWith({ owner: "poll" });
    resolveReplacement({ skipped: false, raw: { error: 0, data: [] }, tasks: [{ hash: "new" }] });
    await Promise.resolve();

    expect(managerMock.abortListDownloads).toHaveBeenCalled();
    expect(stateMock.clearSelection).toHaveBeenCalled();
    expect(uiMock.renderDownloads).toHaveBeenCalledWith([]);
    expect(uiMock.renderDownloads).toHaveBeenLastCalledWith([{ hash: "new" }]);
  });

  it("does not publish an empty snapshot before the replacement connection confirms its tasks", async () => {
    let resolveReplacement!: (result: {
      skipped: false;
      raw: { error: number; data: [] };
      tasks: { hash: string }[];
    }) => void;
    managerMock.listDownloads
      .mockResolvedValueOnce({ skipped: false, raw: { error: 0, data: [] }, tasks: [] })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveReplacement = resolve;
          }),
      );
    const feature = await initializeFeature();
    monitorMock.sendBadgeSnapshot.mockClear();

    feature.connectionChanged();
    expect(monitorMock.sendBadgeSnapshot).not.toHaveBeenCalled();

    resolveReplacement({ skipped: false, raw: { error: 0, data: [] }, tasks: [{ hash: "new" }] });
    await Promise.resolve();

    expect(monitorMock.sendBadgeSnapshot).toHaveBeenCalledOnce();
  });

  it("does not report a late old-connection query rejection after the replacement has rendered", async () => {
    let rejectOldQuery!: (reason: Error) => void;
    managerMock.listDownloads
      .mockResolvedValueOnce({ skipped: false, raw: { error: 0, data: [] }, tasks: [] })
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectOldQuery = reject;
          }),
      )
      .mockResolvedValueOnce({ skipped: false, raw: { error: 0, data: [] }, tasks: [{ hash: "new" }] });
    const feature = await initializeFeature();

    const oldRefresh = feature.refreshNow();
    await Promise.resolve();
    feature.connectionChanged();
    await Promise.resolve();
    vi.clearAllMocks();
    rejectOldQuery(new Error("old connection failed"));
    await oldRefresh;

    expect(uiMock.renderDownloads).not.toHaveBeenCalled();
    expect(statusMock.showStatus).not.toHaveBeenCalled();
  });

  it("replaces an older poll with a fresh post-remove query", async () => {
    let resolvePoll!: (result: { skipped: false; raw: { error: number; data: [] }; tasks: [] }) => void;
    managerMock.listDownloads
      .mockResolvedValueOnce({ skipped: false, raw: { error: 0, data: [] }, tasks: [] })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePoll = resolve;
          }),
      )
      .mockResolvedValueOnce({ skipped: false, raw: { error: 0, data: [] }, tasks: [] });
    managerMock.removeDownload.mockResolvedValue(undefined);
    const feature = await initializeFeature();

    const poll = feature.refreshNow();
    await Promise.resolve();
    await feature.remove("task-1");
    resolvePoll({ skipped: false, raw: { error: 0, data: [] }, tasks: [] });
    await poll;

    expect(managerMock.abortListDownloads).toHaveBeenCalled();
    expect(managerMock.listDownloads).toHaveBeenCalledTimes(3);
    expect(statusMock.showStatus).toHaveBeenLastCalledWith("Download removed", "success", { autoHideMs: 2000 });
  });

  it("retries a skipped post-remove refresh instead of claiming reconciliation", async () => {
    managerMock.removeDownload.mockResolvedValue(undefined);
    managerMock.listDownloads
      .mockResolvedValueOnce({ skipped: false, raw: { error: 0, data: [] }, tasks: [] })
      .mockResolvedValueOnce({ skipped: true })
      .mockResolvedValueOnce({ skipped: false, raw: { error: 0, data: [] }, tasks: [] });
    const feature = await initializeFeature();

    await feature.remove("task-1");

    expect(managerMock.abortListDownloads).toHaveBeenCalledTimes(2);
    expect(managerMock.listDownloads).toHaveBeenCalledTimes(3);
    expect(statusMock.showStatus).toHaveBeenLastCalledWith("Download removed", "success", { autoHideMs: 2000 });
  });

  it("clears an older removal marker after a newer start completes", async () => {
    let resolveRemove!: () => void;
    managerMock.removeDownload.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveRemove = resolve;
        }),
    );
    managerMock.startTorrent.mockResolvedValue(undefined);
    const feature = await initializeFeature();

    const removing = feature.remove("old-task");
    await Promise.resolve();
    await feature.start("other-task");
    resolveRemove();
    await removing;

    expect(uiMock.setRemovingDownload).toHaveBeenLastCalledWith(null);
  });

  it("does not let an older removal clear a newer removal marker", async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    managerMock.removeDownload
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const feature = await initializeFeature();

    const first = feature.remove("old-task");
    await Promise.resolve();
    const second = feature.remove("new-task");
    await Promise.resolve();
    resolveFirst();
    await first;
    expect(uiMock.setRemovingDownload).toHaveBeenLastCalledWith("new-task");

    resolveSecond();
    await second;
    expect(uiMock.setRemovingDownload).toHaveBeenLastCalledWith(null);
  });
});
