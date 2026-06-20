import type { Task, TaskStatus } from "@lib/tasks.js";

export type DownloadFilter = "in-progress" | "completed" | "all";

const IN_PROGRESS_STATUSES: readonly TaskStatus[] = [
  "queued",
  "downloading",
  "paused",
  "checking",
  "repairing",
  "extracting",
  "finishing",
];

export function filterDownloads(tasks: Task[], filter: DownloadFilter, query: string): Task[] {
  const normalizedQuery = query.trim().toLowerCase();

  return tasks.filter((task) => {
    if (filter === "completed" && !isCompleted(task.status)) return false;
    if (filter === "in-progress" && !isInProgress(task.status)) return false;
    return !normalizedQuery || task.name.toLowerCase().includes(normalizedQuery);
  });
}

export function isCompleted(status: TaskStatus): boolean {
  return status === "finished" || status === "seeding";
}

export function isInProgress(status: TaskStatus): boolean {
  return IN_PROGRESS_STATUSES.includes(status);
}
