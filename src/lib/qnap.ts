import type { Settings } from "./config.js";
import { createApiClient } from "../api/client.js";
import { buildNASBaseUrl } from "../api/index.js";
import { normalizeTasks, type Task, type TaskStatus } from "./tasks.js";

export { buildNASBaseUrl };
export { normalizeTasks };
export type { Task, TaskStatus };

export function isTorrentUrl(url: string): boolean {
  return /^magnet:/i.test(url) || /\.torrent$/i.test(url);
}

export async function testNASConnection(settings: Settings): Promise<boolean> {
  const client = createApiClient({ settings });
  return client.testConnection();
}

/**
 * Login to NAS - not needed anymore with middleware!
 * The middleware handles SID automatically on first request.
 * Kept for backward compatibility.
 * @deprecated SID is managed automatically by middleware
 */
export async function loginNAS(settings: Settings): Promise<string> {
  // The middleware will obtain SID on first request
  // For now, we'll make a dummy request to trigger SID retrieval
  const client = createApiClient({ settings });
  try {
    await client.testConnection();
    // If successful, SID will be obtained internally by the middleware
    return "authenticated";
  } catch {
    throw new Error("Failed to authenticate");
  }
}

export async function queryNASTasks(settings: Settings): Promise<any> {
  const client = createApiClient({ settings });
  return client.queryTasksRaw();
}

export async function queryNormalizedTasks(settings: Settings): Promise<Task[]> {
  const client = createApiClient({ settings });
  const { tasks } = await client.queryTasks();
  return tasks;
}

export async function addDownloadUrl(settings: Settings, url: string): Promise<boolean> {
  const client = createApiClient({ settings });
  return client.addUrl(url);
}

export async function addTorrentFile(settings: Settings, file: File): Promise<boolean> {
  const client = createApiClient({ settings });
  const result = await client.addTorrent(file);
  return result.added;
}

export async function removeDownloadTask(settings: Settings, hash: string): Promise<boolean> {
  const client = createApiClient({ settings });
  return client.removeTask(hash);
}
