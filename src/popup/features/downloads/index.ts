import { showStatus } from "@/popup/components";
import { summarizeProgress } from "@lib/tasks.js";

import { requestMonitoring, sendBadgeSnapshot } from "../../shared/monitor.js";

import {
  configureAutoRefresh,
  stopAutoRefresh as haltAutoRefresh,
  startAutoRefresh as runAutoRefresh,
} from "./autoRefresh.js";
import {
  abortListDownloads,
  removeDownload as deleteDownload,
  pauseTorrent as pauseTask,
  listDownloads as queryDownloads,
  startTorrent as startTask,
  stopTorrent as stopTask,
} from "./downloadsManager.js";
import { clearSelection, getSelectedHash, onSelectionChange } from "./downloadsState.js";
import { hideDownloads, renderDownloads, setRemovingDownload, setupDownloadsUI } from "./downloadsUI.js";

export interface DownloadsFeature {
  refreshNow: () => Promise<void>;
  remove: (hash: string) => Promise<void>;
  start: (hash: string) => Promise<void>;
  stop: (hash: string) => Promise<void>;
  pause: (hash: string) => Promise<void>;
  getSelected: () => string | null;
  clearSelection: () => void;
  hideDownloads: () => void;
  onSelectionChange: (listener: (hash: string | null) => void) => () => void;
}

export async function initializeDownloads(): Promise<DownloadsFeature> {
  setupDownloadsUI();

  async function refreshNow(): Promise<void> {
    try {
      const result = await queryDownloads();
      if (result.skipped) {
        return;
      }
      renderDownloads(result.tasks);
      // Hand the background (sole toolbar writer) the same counts the
      // In-progress tab shows, so the app icon can't disagree with the popup.
      sendBadgeSnapshot(summarizeProgress(result.tasks));
    } catch (error) {
      showStatus(`Failed to list downloads: ${error}`, "error");
    }
  }

  configureAutoRefresh({
    onRefresh: () => refreshNow(),
  });

  await refreshNow();
  // Re-arm background monitoring on open so an already-running download turns
  // the toolbar icon active — without it the icon only updates after a mutation.
  // ensureMonitoring polls and self-stops if nothing is actually active.
  requestMonitoring();
  runAutoRefresh();

  window.addEventListener("beforeunload", () => {
    haltAutoRefresh();
    abortListDownloads();
  });

  return {
    refreshNow,
    remove: async (hash: string) => {
      const normalizedHash = hash?.trim();
      if (!normalizedHash) {
        showStatus("Cannot remove download: missing identifier", "error");
        return;
      }
      setRemovingDownload(normalizedHash);
      clearSelection();
      try {
        await deleteDownload(normalizedHash);
        await refreshNow();
      } catch (error) {
        showStatus(`Failed to remove download: ${error}`, "error");
      } finally {
        setRemovingDownload(null);
      }
    },
    start: async (hash: string) => {
      await startTask(hash);
      showStatus("Torrent started", "success", { autoHideMs: 2000 });
    },
    stop: async (hash: string) => {
      await stopTask(hash);
      showStatus("Torrent stopped", "success", { autoHideMs: 2000 });
    },
    pause: async (hash: string) => {
      await pauseTask(hash);
      showStatus("Torrent paused", "info", { autoHideMs: 2000 });
    },
    getSelected: () => getSelectedHash(),
    clearSelection: () => clearSelection(),
    hideDownloads: () => hideDownloads(),
    onSelectionChange: (listener: (hash: string | null) => void) => onSelectionChange(listener),
  };
}
