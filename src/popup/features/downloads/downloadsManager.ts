import type { QueryTasksResult } from "@api/client.js";
import type { ApiClient } from "@api/client.js";
import { getApiClient } from "../../shared/api/index.js";
import { buildTaskSnapshot, updateSnapshot } from "./downloadsState.js";

let listAbortController: AbortController | null = null;

export interface ListDownloadsResult extends QueryTasksResult {
  skipped: boolean;
}

async function ensureClient(): Promise<ApiClient> {
  return getApiClient();
}

export async function listDownloads(): Promise<ListDownloadsResult> {
  if (listAbortController) {
    return { skipped: true, raw: { data: [] } as any, tasks: [] };
  }

  const controller = new AbortController();
  listAbortController = controller;

  try {
    const client = await ensureClient();
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
  const client = await ensureClient();
  const raw = await client.queryTasksRaw();
  const snapshot = buildTaskSnapshot(Array.isArray(raw?.data) ? raw.data : []);
  updateSnapshot(snapshot);
}

export async function removeDownload(hash: string): Promise<void> {
  const client = await ensureClient();
  await client.removeTask(hash);
}

export async function startTorrent(hash: string): Promise<void> {
  const client = await ensureClient();
  await client.startTask(hash);
}

export async function stopTorrent(hash: string): Promise<void> {
  const client = await ensureClient();
  await client.stopTask(hash);
}
