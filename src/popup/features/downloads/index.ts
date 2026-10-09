import { summarizeProgress } from "@lib/tasks.js";
import { getErrorMessage } from "@lib/errors.js";
import { clearStatus, showStatus } from "@/popup/components";

import { requestMonitoring, sendBadgeSnapshot } from "../../shared/monitor.js";

import {
  configureAutoRefresh,
  stopAutoRefresh as haltAutoRefresh,
  startAutoRefresh as runAutoRefresh,
} from "./autoRefresh.js";
import {
  abortListDownloads,
  removeDownload as deleteDownload,
  PauseFallbackStopError,
  pauseTorrent as pauseTask,
  listDownloads as queryDownloads,
  startTorrent as startTask,
  stopTorrent as stopTask,
} from "./downloadsManager.js";
import { clearSelection, getSelectedHash, onSelectionChange } from "./downloadsState.js";
import { hideDownloads, renderDownloads, setRemovingDownload, setupDownloadsUI } from "./downloadsUI.js";

export type DownloadsFeature = {
  refreshNow: () => Promise<"refreshed" | "skipped" | "failed">;
  remove: (hash: string, clean?: boolean) => Promise<void>;
  start: (hash: string) => Promise<void>;
  stop: (hash: string) => Promise<void>;
  pause: (hash: string) => Promise<void>;
  getSelected: () => string | null;
  clearSelection: () => void;
  hideDownloads: () => void;
  abortRefresh: () => void;
  connectionChanged: () => void;
  onSelectionChange: (listener: (hash: string | null) => void) => () => void;
};

export async function initializeDownloads(): Promise<DownloadsFeature> {
  setupDownloadsUI();
  let latestUserOperation = 0;
  let latestRemovalOperation = 0;
  let connectionGeneration = 0;

  async function refreshNow(generation = connectionGeneration): Promise<"refreshed" | "skipped" | "failed"> {
    try {
      const result = await queryDownloads();
      if (result.skipped || generation !== connectionGeneration) {
        return "skipped";
      }
      renderDownloads(result.tasks);
      // Hand the background (sole toolbar writer) the same counts the
      // In-progress tab shows, so the app icon can't disagree with the popup.
      sendBadgeSnapshot(summarizeProgress(result.tasks));
      clearStatus({ owner: "poll" });
      return "refreshed";
    } catch (error) {
      if (generation !== connectionGeneration) {
        return "skipped";
      }
      showStatus(`Failed to list downloads: ${getErrorMessage(error)}`, "error", { owner: "poll" });
      return "failed";
    }
  }

  configureAutoRefresh({
    onRefresh: async () => {
      await refreshNow();
    },
  });

  await refreshNow();
  // Re-arm background monitoring on open so an already-running download turns
  // the toolbar icon active — without it the icon only updates after a mutation.
  // ensureMonitoring polls and self-stops if nothing is actually active.
  requestMonitoring();
  runAutoRefresh();

  window.addEventListener("beforeunload", () => {
    connectionGeneration += 1;
    haltAutoRefresh();
    abortListDownloads();
  });

  return {
    refreshNow,
    remove: async (hash: string, clean = false) => {
      const operation = ++latestUserOperation;
      const removalOperation = ++latestRemovalOperation;
      const normalizedHash = hash?.trim();
      if (!normalizedHash) {
        showStatus("Cannot remove: missing ID", "error");
        return;
      }
      setRemovingDownload(normalizedHash);
      clearSelection();
      try {
        await deleteDownload(normalizedHash, clean);
      } catch (error) {
        if (operation !== latestUserOperation) return;
        const target = clean ? "download and files" : "download";
        showStatus(`Failed to remove ${target}: ${getErrorMessage(error)}`, "error");
        return;
      } finally {
        if (removalOperation === latestRemovalOperation) setRemovingDownload(null);
      }

      if (operation !== latestUserOperation) return;
      abortListDownloads();
      let refresh = await refreshNow(connectionGeneration);
      if (refresh === "skipped" && operation === latestUserOperation) {
        abortListDownloads();
        refresh = await refreshNow(connectionGeneration);
      }
      if (operation !== latestUserOperation) return;
      if (refresh === "failed") {
        showStatus("Download removed, but failed to refresh the list", "error");
      } else if (refresh === "skipped") {
        showStatus("Download removed, but the list refresh did not complete", "error");
      } else {
        showStatus("Download removed", "success", { autoHideMs: 2000 });
      }
    },
    start: async (hash: string) => {
      const operation = ++latestUserOperation;
      try {
        await startTask(hash);
        if (operation === latestUserOperation) showStatus("Download started", "success", { autoHideMs: 2000 });
      } catch (error) {
        if (operation === latestUserOperation)
          showStatus(`Failed to start download: ${getErrorMessage(error)}`, "error");
      }
    },
    stop: async (hash: string) => {
      const operation = ++latestUserOperation;
      try {
        await stopTask(hash);
        if (operation === latestUserOperation) showStatus("Download stopped", "success", { autoHideMs: 2000 });
      } catch (error) {
        if (operation === latestUserOperation)
          showStatus(`Failed to stop download: ${getErrorMessage(error)}`, "error");
      }
    },
    pause: async (hash: string) => {
      const operation = ++latestUserOperation;
      try {
        const outcome = await pauseTask(hash);
        if (operation === latestUserOperation) {
          showStatus(
            outcome === "stopped" ? "Download stopped" : "Download paused",
            outcome === "stopped" ? "success" : "info",
            { autoHideMs: 2000 },
          );
        }
      } catch (error) {
        if (operation === latestUserOperation) {
          showStatus(
            error instanceof PauseFallbackStopError
              ? `Failed to stop download: ${getErrorMessage(error.stopError)}`
              : `Failed to pause download: ${getErrorMessage(error)}`,
            "error",
          );
        }
      }
    },
    getSelected: () => getSelectedHash(),
    clearSelection: () => clearSelection(),
    hideDownloads: () => hideDownloads(),
    abortRefresh: () => abortListDownloads(),
    connectionChanged: () => {
      connectionGeneration += 1;
      latestUserOperation += 1;
      latestRemovalOperation += 1;
      clearStatus({ owner: "poll" });
      abortListDownloads();
      clearSelection();
      setRemovingDownload(null);
      renderDownloads([]);
      void refreshNow(connectionGeneration);
    },
    onSelectionChange: (listener: (hash: string | null) => void) => onSelectionChange(listener),
  };
}
