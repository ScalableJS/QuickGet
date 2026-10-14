import type { QueryTasksResult, TaskPriorityAction, TorrentFile } from "@api/client.js";

import { getErrorMessage } from "@lib/errors.js";

import { getApiClient } from "../../shared/api";
import { requestMonitoring } from "../../shared/monitor.js";

let listAbortController: AbortController | null = null;

export type ListDownloadsResult = ({ skipped: false } & QueryTasksResult) | { skipped: true };

export class PauseFallbackStopError extends Error {
  readonly stopError: unknown;

  constructor(stopError: unknown) {
    super(getErrorMessage(stopError));
    this.name = "PauseFallbackStopError";
    this.stopError = stopError;
  }
}

export async function listDownloads(): Promise<ListDownloadsResult> {
  if (listAbortController) {
    return { skipped: true };
  }

  const controller = new AbortController();
  listAbortController = controller;

  try {
    const client = await getApiClient();
    const { raw, tasks } = await client.queryTasks({ signal: controller.signal });

    if (controller.signal.aborted || listAbortController !== controller) {
      return { skipped: true };
    }

    return {
      skipped: false,
      raw,
      tasks,
    };
  } catch (error) {
    if (controller.signal.aborted || listAbortController !== controller) {
      return { skipped: true };
    }
    throw error;
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

export async function removeDownload(hash: string, clean = false): Promise<void> {
  const client = await getApiClient();
  await client.removeTask(hash, { clean });
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

export async function pauseTorrent(hash: string): Promise<"paused" | "stopped"> {
  const client = await getApiClient();
  try {
    await client.pauseTask(hash);
    return "paused";
  } catch (error) {
    // Older Download Station builds lack Task/Pause (error 2 / "no such api").
    // Only then fall back to Stop; other failures should surface.
    if (hasUnsupportedApiError(error)) {
      try {
        await client.stopTask(hash);
        return "stopped";
      } catch (stopError) {
        throw new PauseFallbackStopError(stopError);
      }
    }
    throw error;
  }
}

function hasUnsupportedApiError(error: unknown): error is { apiUnsupported: true } {
  return typeof error === "object" && error !== null && "apiUnsupported" in error && error.apiUnsupported === true;
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

export async function setTaskPriority(hash: string, priority: TaskPriorityAction): Promise<void> {
  const client = await getApiClient();
  await client.setTaskPriority(hash, priority);
}
