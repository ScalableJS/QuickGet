import type { TaskPriorityAction } from "@api/client.js";
import { isCompleted, isInProgress, isReorderableStatus, type Task } from "@lib/tasks.js";

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

/**
 * Optimistically reorders the task list for queue priority actions ("top", "up", "down").
 * Only swaps or moves among tasks that participate in the download queue.
 */
export function reorderTasks(tasks: Task[], hash: string, priority: TaskPriorityAction): Task[] {
  const index = tasks.findIndex((t) => (t.hash ?? t.id) === hash);
  if (index === -1) return tasks;

  const next = [...tasks];
  const item = next[index];

  if (priority === "top") {
    const firstReorderable = next.findIndex((t) => isReorderableStatus(t.status));
    if (firstReorderable !== -1 && firstReorderable < index) {
      next.splice(index, 1);
      next.splice(firstReorderable, 0, item);
    } else if (index > 0) {
      next.splice(index, 1);
      next.unshift(item);
    }
  } else if (priority === "up") {
    let prevIndex = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (isReorderableStatus(next[i].status)) {
        prevIndex = i;
        break;
      }
    }
    if (prevIndex !== -1) {
      next[index] = next[prevIndex];
      next[prevIndex] = item;
    }
  } else if (priority === "down") {
    let nextIndex = -1;
    for (let i = index + 1; i < next.length; i++) {
      if (isReorderableStatus(next[i].status)) {
        nextIndex = i;
        break;
      }
    }
    if (nextIndex !== -1) {
      next[index] = next[nextIndex];
      next[nextIndex] = item;
    }
  }

  return next;
}
