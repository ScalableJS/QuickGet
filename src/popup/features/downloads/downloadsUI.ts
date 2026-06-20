import type { Task } from "@lib/tasks.js";
import { mount } from "svelte";

import { formatRate } from "../../shared/formatters";
import { toolbarView } from "../toolbar/toolbarView.svelte.js";

import DownloadsList from "./DownloadsList.svelte";
import { getSelectedHash, onSelectionChange, setSelectedHash } from "./downloadsState.js";
import { downloadsView } from "./downloadsView.svelte.js";

let downloadsSection: HTMLElement | null = null;
let mounted = false;

function toggleSelection(hash: string): void {
  const current = getSelectedHash();
  setSelectedHash(current === hash ? null : hash);
}

function updateStatusSpeed(tasks: Task[]): void {
  const totalDown = tasks.reduce((sum, task) => sum + (task.downSpeedBps || 0), 0);
  const totalUp = tasks.reduce((sum, task) => sum + (task.upSpeedBps || 0), 0);
  toolbarView.statusDownloadSpeed = formatRate(totalDown);
  toolbarView.statusUploadSpeed = formatRate(totalUp);
}

function ensureElements(): void {
  if (!downloadsSection) {
    downloadsSection = document.getElementById("downloads-section") as HTMLElement | null;
  }
}

export function setupDownloadsUI(): void {
  ensureElements();

  if (downloadsSection && !mounted) {
    downloadsSection.replaceChildren();
    downloadsView.selectedHash = getSelectedHash();
    mount(DownloadsList, {
      target: downloadsSection,
      props: { view: downloadsView, onToggle: toggleSelection },
    });
    mounted = true;
  }

  onSelectionChange((hash) => {
    downloadsView.selectedHash = hash;
  });
}

export function renderDownloads(tasks: Task[]): void {
  ensureElements();
  if (!downloadsSection) return;

  downloadsView.tasks = tasks;

  const settingsPanel = document.getElementById("settings-panel");
  const settingsOpen = settingsPanel ? !settingsPanel.classList.contains("hidden") : false;
  if (!settingsOpen) {
    downloadsSection.classList.remove("hidden");
  }

  updateStatusSpeed(tasks);
}

export function hideDownloads(): void {
  ensureElements();
  downloadsSection?.classList.add("hidden");
}
