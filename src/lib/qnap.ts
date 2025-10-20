import type { Settings } from "./config.js";
import { createApiClient, buildNASBaseUrl } from "./apiClient.js";
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

export async function loginNAS(settings: Settings): Promise<string> {
  const client = createApiClient({ settings });
  return client.login();
}

export async function queryNASTasks(settings: Settings, sid?: string): Promise<any> {
  const client = createApiClient({ settings });
  if (sid) client.setSid(sid);
  return client.queryTasksRaw();
}

export async function queryNormalizedTasks(settings: Settings, sid?: string): Promise<Task[]> {
  const client = createApiClient({ settings });
  if (sid) client.setSid(sid);
  const { tasks } = await client.queryTasks();
  return tasks;
}

export async function addDownloadUrl(settings: Settings, sid: string, url: string): Promise<boolean> {
  const client = createApiClient({ settings });
  client.setSid(sid);
  return client.addUrl(url);
}

export async function addTorrentFile(settings: Settings, sid: string, file: File): Promise<boolean> {
  const client = createApiClient({ settings });
  client.setSid(sid);
  const result = await client.addTorrent(file);
  return result.added;
}

export async function removeDownloadTask(settings: Settings, sid: string, hash: string): Promise<boolean> {
  const client = createApiClient({ settings });
  client.setSid(sid);
  return client.removeTask(hash);
}
