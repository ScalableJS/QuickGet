import type { Task } from "@lib/tasks.js";

import { showStatus } from "@/popup/components";

import {
  configureAutoRefresh,
  stopAutoRefresh as haltAutoRefresh,
  isAutoRefreshRunning,
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
import { clearSelection, getSelectedHash, onSelectionChange, setSelectedHash } from "./downloadsState.js";
import { hideDownloads, renderDownloads, setupDownloadsUI } from "./downloadsUI.js";

interface InitializeDownloadsOptions {
  onSelectionChange?: (hash: string | null) => void;
  onSnapshotUpdated?: (tasks: Task[]) => void;
  onRefresh?: (tasks: Task[]) => void;
}

export interface DownloadsFeature {
  refreshNow: () => Promise<void>;
  remove: (hash: string) => Promise<void>;
  start: (hash: string) => Promise<void>;
  stop: (hash: string) => Promise<void>;
  pause: (hash: string) => Promise<void>;
  getSelected: () => string | null;
  setSelected: (hash: string | null) => void;
  clearSelection: () => void;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  isAutoRefreshRunning: () => boolean;
  hideDownloads: () => void;
  onSelectionChange: (listener: (hash: string | null) => void) => () => void;
}

export async function initializeDownloads(options: InitializeDownloadsOptions = {}): Promise<DownloadsFeature> {
  setupDownloadsUI({
    onSelectionChange: (hash) => {
      options.onSelectionChange?.(hash);
    },
  });

  async function refreshNow(): Promise<void> {
    try {
      const result = await queryDownloads();
      if (result.skipped) {
        return;
      }

      renderDownloads(result.tasks);
      options.onRefresh?.(result.tasks);
      options.onSnapshotUpdated?.(result.tasks);
    } catch (error) {
      showStatus(`Failed to list downloads: ${error}`, "error");
    }
  }

  configureAutoRefresh({
    onRefresh: () => refreshNow(),
  });

  await refreshNow();
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
      await deleteDownload(normalizedHash);
      showStatus("Download removed", "success", { autoHideMs: 2000 });
      await refreshNow();
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
    setSelected: (hash: string | null) => setSelectedHash(hash),
    clearSelection: () => clearSelection(),
    startAutoRefresh: () => runAutoRefresh(),
    stopAutoRefresh: () => haltAutoRefresh(),
    isAutoRefreshRunning: () => isAutoRefreshRunning(),
    hideDownloads: () => hideDownloads(),
    onSelectionChange: (listener: (hash: string | null) => void) => onSelectionChange(listener),
  };
}
