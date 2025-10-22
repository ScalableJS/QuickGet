import type { Task } from "@lib/tasks.js";

import { renderDownloadItem, renderEmptyDownloadState } from "../components/downloadItem/index.js";

export { renderDownloadItem, renderEmptyDownloadState };

export function renderDownloadsList(tasks: Task[]): string {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return renderEmptyDownloadState();
  }

  return tasks.map((task) => renderDownloadItem(task)).join("");
}
