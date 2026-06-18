import type { Task } from "@lib/tasks.js";

import { getDownloadItemView } from "./format.js";

export interface DownloadItemOptions {
  selected?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Legacy string renderer — retained for Storybook stories and tests. The live
 * popup renders via DownloadItem.svelte; both share `getDownloadItemView`.
 */
export function renderDownloadItem(task: Task, options: DownloadItemOptions = {}): string {
  const view = getDownloadItemView(task);
  const selectedClass = options.selected ? " selected" : "";
  const ariaSelected = options.selected ? "true" : "false";

  return `<article class="download-item${selectedClass}" data-hash="${escapeHtml(
    view.hash,
  )}" data-status="${escapeHtml(task.status)}" tabindex="0" role="option" aria-selected="${ariaSelected}">
    <div class="download-info">
      <p class="download-name">${escapeHtml(task.name)}</p>
      <div class="download-meta">
        <span class="download-status">${escapeHtml(view.statusText)}</span>
        <span class="download-speed">${escapeHtml(view.metaText)}${escapeHtml(view.etaSuffix)}</span>
      </div>
      ${view.addedText ? `<p class="download-added">Added ${escapeHtml(view.addedText)}</p>` : ""}
      <div class="progress-container">
        <span class="progress-icon" aria-label="${escapeHtml(view.statusLabel)}">${view.statusIcon}</span>
        <div class="progress-bar">
          <div class="progress-fill ${view.progressModifier}" style="width: ${view.progress}%"></div>
        </div>
      </div>
    </div>
  </article>`;
}

export function renderEmptyDownloadState(): string {
  return '<div class="download-empty" role="note">No active downloads</div>';
}

export function createDownloadItemElement(task: Task, options: DownloadItemOptions = {}): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderDownloadItem(task, options);
  const element = wrapper.firstElementChild;
  if (!element || !(element instanceof HTMLElement)) {
    throw new Error("Failed to create download item element");
  }
  return element;
}
