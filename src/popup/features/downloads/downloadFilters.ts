import { isCompleted, isInProgress, type Task } from "@lib/tasks.js";

// Re-exported so existing popup imports keep their familiar source.
export { isCompleted, isInProgress } from "@lib/tasks.js";

export type DownloadFilter = "in-progress" | "completed" | "all";

export function filterDownloads(tasks: Task[], filter: DownloadFilter, query: string): Task[] {
  const normalizedQuery = query.trim().toLowerCase();

  return tasks.filter((task) => {
    if (filter === "completed" && !isCompleted(task.status)) return false;
    if (filter === "in-progress" && !isInProgress(task.status)) return false;
    return !normalizedQuery || task.name.toLowerCase().includes(normalizedQuery);
  });
}
