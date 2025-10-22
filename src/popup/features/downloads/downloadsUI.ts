import type { Task } from "@lib/tasks.js";
import { morphDOMUpdateList } from "../../shared/dom/index.js";
import { formatRate } from "../../shared/formatters/index.js";
import { renderDownloadsList } from "../../render/downloads.js";
import {
  getSelectedHash,
  setSelectedHash,
  onSelectionChange,
  onSnapshotChange,
  type DownloadsSnapshot,
} from "./downloadsState.js";

interface DownloadsUIOptions {
  onSelectionChange?: (hash: string | null) => void;
}

let downloadsSection: HTMLElement | null = null;
let downloadsList: HTMLElement | null = null;
let statusSpeedElement: HTMLElement | null = null;

function findDownloadItem(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  return target.closest(".download-item");
}

function refreshSelectionUI(): void {
  if (!downloadsList) return;
  const items = downloadsList.querySelectorAll(".download-item");
  const currentSelection = getSelectedHash();
  items.forEach((node) => {
    const item = node as HTMLElement;
    const hash = item.getAttribute("data-hash");
    const isSelected = !!currentSelection && hash === currentSelection;
    item.classList.toggle("selected", isSelected);
    item.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
}

function focusSelected(): void {
  if (!downloadsList) return;
  const currentSelection = getSelectedHash();
  if (!currentSelection) return;
  const selector = `.download-item[data-hash="${currentSelection.replace(/["\\]/g, "\\$&")}"]`;
  const selectedItem = downloadsList.querySelector<HTMLElement>(selector);
  selectedItem?.focus({ preventScroll: false });
}

function toggleSelectionForItem(item: HTMLElement | null): void {
  if (!item) return;
  const hash = item.getAttribute("data-hash");
  if (!hash) return;
  const current = getSelectedHash();
  setSelectedHash(current === hash ? null : hash);
  refreshSelectionUI();
}

function updateStatusSpeed(tasks: Task[]): void {
  if (!statusSpeedElement) return;
  const totalDown = tasks.reduce((sum, task) => sum + (task.downSpeedBps || 0), 0);
  const totalUp = tasks.reduce((sum, task) => sum + (task.upSpeedBps || 0), 0);
  statusSpeedElement.textContent = `↓ ${formatRate(totalDown)} ↑ ${formatRate(totalUp)}`;
}

function ensureElements(): void {
  if (!downloadsSection) {
    downloadsSection = document.getElementById("downloads-section") as HTMLElement | null;
  }
  if (!downloadsList) {
    downloadsList = document.getElementById("downloads-list") as HTMLElement | null;
  }
  if (!statusSpeedElement) {
    statusSpeedElement = document.getElementById("status-speed") as HTMLElement | null;
  }
}

export function setupDownloadsUI(options: DownloadsUIOptions = {}): void {
  ensureElements();

  downloadsList?.addEventListener("click", (event) => {
    toggleSelectionForItem(findDownloadItem(event.target));
  });

  downloadsList?.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    const item = findDownloadItem(event.target);
    if (!item) return;
    event.preventDefault();
    toggleSelectionForItem(item);
  });

  onSelectionChange((hash) => {
    refreshSelectionUI();
    options.onSelectionChange?.(hash);
  });

  onSnapshotChange((_snapshot: DownloadsSnapshot) => {
    // Snapshot updates do not require immediate UI work here,
    // but hook left for future enhancements.
  });
}

export function renderDownloads(tasks: Task[]): void {
  ensureElements();
  if (!downloadsList || !downloadsSection) return;

  const html = renderDownloadsList(tasks);
  morphDOMUpdateList(downloadsList, html);

  const settingsPanel = document.getElementById("settings-panel");
  const settingsOpen = settingsPanel ? !settingsPanel.classList.contains("hidden") : false;
  if (!settingsOpen) {
    downloadsSection.classList.remove("hidden");
  }

  refreshSelectionUI();
  focusSelected();
  updateStatusSpeed(tasks);
}

export function hideDownloads(): void {
  ensureElements();
  downloadsSection?.classList.add("hidden");
}
