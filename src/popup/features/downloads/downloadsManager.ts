import type { QueryTasksResult, TorrentFile } from "@api/client.js";

import { getApiClient } from "../../shared/api";
import { requestMonitoring } from "../../shared/monitor.js";

import { buildTaskSnapshot, updateSnapshot } from "./downloadsState.js";

let listAbortController: AbortController | null = null;

export type ListDownloadsResult = ({ skipped: false } & QueryTasksResult) | { skipped: true };

export async function listDownloads(): Promise<ListDownloadsResult> {
  if (listAbortController) {
    return { skipped: true };
  }

  const controller = new AbortController();
  listAbortController = controller;

  try {
    const client = await getApiClient();
    const { raw, tasks } = await client.queryTasks({ signal: controller.signal });

    const snapshot = buildTaskSnapshot(Array.isArray(raw?.data) ? raw.data : []);
    updateSnapshot(snapshot);

    return {
      skipped: false,
      raw,
      tasks,
    };
  } finally {
    if (listAbortController === controller) {
      listAbortController = null;
    }
  }
}

export function abortListDownloads(): void {
  if (listAbortController) {
    listAbortController.abort();
    listAbortController = null;
  }
}

export async function refreshSnapshot(): Promise<void> {
  const client = await getApiClient();
  const raw = await client.queryTasksRaw();
  const snapshot = buildTaskSnapshot(Array.isArray(raw?.data) ? raw.data : []);
  updateSnapshot(snapshot);
}

export async function removeDownload(hash: string): Promise<void> {
  const client = await getApiClient();
  await client.removeTask(hash);
}

export async function startTorrent(hash: string): Promise<void> {
  const client = await getApiClient();
  await client.startTask(hash);
  requestMonitoring();
}

export async function stopTorrent(hash: string): Promise<void> {
  const client = await getApiClient();
  await client.stopTask(hash);
}

export async function pauseTorrent(hash: string): Promise<void> {
  const client = await getApiClient();
  // Older Download Station builds lack Task/Pause; fall back to Stop (covered by tests).
  if (typeof client.pauseTask === "function") {
    await client.pauseTask(hash);
    return;
  }
  await client.stopTask(hash);
}

export async function getTorrentFiles(hash: string): Promise<TorrentFile[]> {
  const client = await getApiClient();
  return client.getTaskFiles(hash);
}

export async function setTorrentFiles(
  hash: string,
  selections: { index: number; priority: 0 | 1 }[],
): Promise<{ index: number; ok: boolean; error?: string }[]> {
  const client = await getApiClient();
  return client.setTaskFiles(hash, selections);
}
