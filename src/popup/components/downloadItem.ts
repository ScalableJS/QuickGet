import type { Task } from "@lib/tasks.js";

export interface DownloadItemOptions {
  selected?: boolean;
}

const SPEED_UNITS = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatSpeed(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B/s";
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < SPEED_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${SPEED_UNITS[unitIndex]}`;
}

function formatETA(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatAddedDate(value?: number): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { hour12: false });
}

function formatStatus(status: string): string {
  const statusLabels: Record<string, string> = {
    queued: "Queued",
    downloading: "Downloading",
    seeding: "Seeding",
    paused: "Paused",
    stopped: "Stopped",
    checking: "Checking",
    repairing: "Repairing",
    extracting: "Extracting",
    finishing: "Finishing",
    finished: "Finished",
    error: "Error",
  };
  return statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    queued: "⏸",
    downloading: "▶",
    seeding: "🌱",
    paused: "⏸",
    stopped: "⏹",
    checking: "🔍",
    repairing: "🔧",
    extracting: "📦",
    finishing: "⏳",
    finished: "✓",
    error: "✗",
  };
  return icons[status] || "•";
}

export function renderDownloadItem(task: Task, options: DownloadItemOptions = {}): string {
  const progress = Math.max(0, Math.min(100, Math.round(task.progress)));
  const isComplete = task.status === "finished" || task.status === "seeding" || progress >= 100;
  const isError = task.status === "error";
  const isActive = task.status === "downloading" || task.status === "checking" || task.status === "repairing" || task.status === "extracting" || task.status === "finishing";
  
  const statusText = `${formatStatus(task.status)} — ${progress}%`;
  const statusIcon = getStatusIcon(task.status);
  const speedText = `${formatSpeed(task.downSpeedBps)} ↓ ${formatSpeed(task.upSpeedBps)} ↑`;
  const etaText = formatETA(task.etaSec);
  const addedText = formatAddedDate(task.addedAt);
  const hash = escapeHtml(task.hash ?? task.id);
  const name = escapeHtml(task.name);
  const ariaSelected = options.selected ? "true" : "false";
  const selectedClass = options.selected ? " selected" : "";
  const etaSuffix = etaText ? ` • ETA: ${escapeHtml(etaText)}` : "";
  
  let progressClass = "progress-fill";
  if (isError) {
    progressClass += " progress-error";
  } else if (isComplete) {
    progressClass += " progress-complete";
  } else if (isActive) {
    progressClass += " progress-active";
  }

  return `<article class="download-item${selectedClass}" data-hash="${hash}" data-status="${escapeHtml(
    task.status
  )}" tabindex="0" role="option" aria-selected="${ariaSelected}">
    <div class="download-info">
      <p class="download-name">${name}</p>
      <div class="download-meta">
        <span class="download-status">${escapeHtml(statusText)}</span>
        <span class="download-speed">${escapeHtml(speedText)}${etaSuffix}</span>
      </div>
      ${
        addedText
          ? `<p class="download-added">Added ${escapeHtml(addedText)}</p>`
          : ""
      }
      <div class="progress-container">
        <span class="progress-icon" aria-label="${escapeHtml(formatStatus(task.status))}">${statusIcon}</span>
        <div class="progress-bar">
          <div class="${progressClass}" style="width: ${progress}%"></div>
        </div>
      </div>
    </div>
  </article>`;
}

export function renderEmptyDownloadState(): string {
  return `<div class="download-empty" role="note">No active downloads</div>`;
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
