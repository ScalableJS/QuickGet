import type { Task } from "@lib/tasks.js";
import { showStatus } from "../../components/statusPill/index.js";
import {
  listDownloads as queryDownloads,
  removeDownload as deleteDownload,
  startTorrent as startTask,
  stopTorrent as stopTask,
  abortListDownloads,
} from "./downloadsManager.js";
import { setupDownloadsUI, renderDownloads, hideDownloads } from "./downloadsUI.js";
import {
  configureAutoRefresh,
  startAutoRefresh as runAutoRefresh,
  stopAutoRefresh as haltAutoRefresh,
  isAutoRefreshRunning,
} from "./autoRefresh.js";
import {
  getSelectedHash,
  setSelectedHash,
  clearSelection,
  onSelectionChange,
} from "./downloadsState.js";

interface InitializeDownloadsOptions {
  onSelectionChange?: (hash: string | null) => void;
  onLog?: (message: string) => void;
  onSnapshotUpdated?: (tasks: Task[]) => void;
  onRefresh?: (tasks: Task[]) => void;
}

interface RefreshOptions {
  silent?: boolean;
}

export interface DownloadsFeature {
  refreshNow: (options?: RefreshOptions) => Promise<void>;
  remove: (hash: string) => Promise<void>;
  start: (hash: string) => Promise<void>;
  stop: (hash: string) => Promise<void>;
  getSelected: () => string | null;
  setSelected: (hash: string | null) => void;
  clearSelection: () => void;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  isAutoRefreshRunning: () => boolean;
  hideDownloads: () => void;
  onSelectionChange: (listener: (hash: string | null) => void) => () => void;
}

function defaultLog(message: string): void {
  console.debug(`[Downloads] ${message}`);
}

export async function initializeDownloads(options: InitializeDownloadsOptions = {}): Promise<DownloadsFeature> {
  const log = options.onLog ?? defaultLog;

  setupDownloadsUI({
    onSelectionChange: (hash) => {
      log(hash ? `[Selection] ${hash}` : "[Selection] none");
      options.onSelectionChange?.(hash);
    },
  });

  async function refreshNow(refreshOptions: RefreshOptions = {}): Promise<void> {
    try {
      const result = await queryDownloads();
      if (result.skipped) {
        log("Download list request already in progress, skipping...");
        return;
      }

      renderDownloads(result.tasks);
      options.onRefresh?.(result.tasks);
      options.onSnapshotUpdated?.(result.tasks);

      const message =
        result.tasks.length === 0 ? "No active downloads" : `Found ${result.tasks.length} download(s)`;
      if (!refreshOptions.silent) {
        log(message);
      }
    } catch (error) {
      showStatus(`Failed to list downloads: ${error}`, "error");
      log(`Download list error: ${error}`);
    }
  }

  configureAutoRefresh({
    onRefresh: () => refreshNow({ silent: true }),
    onLog: log,
  });

  await refreshNow();
  log("Starting auto-refresh...");
  runAutoRefresh();

  window.addEventListener("beforeunload", () => {
    haltAutoRefresh();
    abortListDownloads();
  });

  return {
    refreshNow,
    remove: async (hash: string) => {
      await deleteDownload(hash);
      showStatus("Download removed", "success", { autoHideMs: 2000 });
      await refreshNow({ silent: true });
    },
    start: async (hash: string) => {
      await startTask(hash);
      showStatus("Torrent started", "success", { autoHideMs: 2000 });
    },
    stop: async (hash: string) => {
      await stopTask(hash);
      showStatus("Torrent stopped", "success", { autoHideMs: 2000 });
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
