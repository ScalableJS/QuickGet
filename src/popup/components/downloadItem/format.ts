import type { Task } from "@lib/tasks.js";

const SPEED_UNITS = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"] as const;
const SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

const STATUS_LABELS: Record<string, string> = {
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

function formatSpeed(bytes: number): string {
  return scaleUnit(bytes, SPEED_UNITS);
}

function formatBytes(bytes: number): string {
  return scaleUnit(bytes, SIZE_UNITS);
}

function scaleUnit(bytes: number, units: readonly string[]): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return `0 ${units[0]}`;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
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
  return STATUS_LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

export type DownloadItemView = {
  hash: string;
  statusLabel: string;
  isDownloadComplete: boolean;
  downloadSpeedText: string;
  uploadSpeedText: string;
  uploadedText: string;
  ratioText: string;
  etaText: string;
  speedLabel: string;
  addedText: string;
  progress: number;
  progressVariant: "active" | "complete" | "error";
};

/**
 * Pure presentation model for a download item — shared by the Svelte component
 * and the Storybook stories.
 */
export function getDownloadItemView(task: Task): DownloadItemView {
  const progress = Math.max(0, Math.min(100, Math.round(task.progress)));
  const isComplete = task.status === "finished" || task.status === "seeding" || progress >= 100;
  const isError = task.status === "error";
  const isActive =
    task.status === "downloading" ||
    task.status === "checking" ||
    task.status === "repairing" ||
    task.status === "extracting" ||
    task.status === "finishing";

  // Seeding/finished tasks have finished downloading — show a full bar and skip
  // the misleading partial percentage QNAP reports for them.
  const isDownloadComplete = task.status === "seeding" || task.status === "finished";
  const ratioText = task.shareRatio !== undefined && Number.isFinite(task.shareRatio) ? task.shareRatio.toFixed(2) : "";

  const etaText = isDownloadComplete ? "" : formatETA(task.etaSec);
  const downloadSpeedText = formatSpeed(task.downSpeedBps);
  const uploadSpeedText = formatSpeed(task.upSpeedBps);
  const uploadedText = formatBytes(task.uploadedBytes);
  const speedLabel = isDownloadComplete
    ? `Uploaded ${uploadedText}${ratioText ? `, ratio ${ratioText}` : ""}; upload speed ${uploadSpeedText}`
    : `Download speed ${downloadSpeedText}; upload speed ${uploadSpeedText}${etaText ? `; ETA ${etaText}` : ""}`;

  let progressVariant: "active" | "complete" | "error" = "active";
  if (isError) progressVariant = "error";
  else if (isComplete) progressVariant = "complete";
  else if (isActive) progressVariant = "active";

  return {
    hash: task.hash ?? task.id,
    statusLabel: formatStatus(task.status),
    isDownloadComplete,
    downloadSpeedText,
    uploadSpeedText,
    uploadedText,
    ratioText,
    etaText,
    speedLabel,
    addedText: formatAddedDate(task.addedAt),
    progress: isComplete ? 100 : progress,
    progressVariant,
  };
}
