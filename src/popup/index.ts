/**
 * Popup UI script
 * Manages settings configuration and download list display
 */

import type { Settings } from "@lib/config.js";
import { loadSettings, saveSettings } from "@lib/settings.js";
import { createApiClient, type ApiClient } from "@lib/apiClient.js";
import type { Task } from "@lib/tasks.js";
import { createLogger } from "@lib/logger.js";
import { renderDownloadsList } from "./render/downloads.js";
import { morphDOMUpdateList } from "./update/dom.js";

// Debug log storage
let debugLogs: string[] = [];
let debugLoggingEnabled = false;
const uiLogger = createLogger("Popup", { enabled: false });
const apiLogger = createLogger("QNAP", { enabled: false });

// Auto-refresh interval for downloads list (5 seconds)
let refreshInterval: ReturnType<typeof setInterval> | null = null;
let listAbortController: AbortController | null = null;

// Download selection state
let selectedHash: string | null = null;
let snapshot: { hashes: Set<string>; names: Set<string> } = {
  hashes: new Set(),
  names: new Set(),
};

// Cached API client keyed by settings
let clientCache: { signature: string; client: ApiClient } | null = null;

function serializeSettings(settings: Settings): string {
  return JSON.stringify([
    settings.NASsecure,
    settings.NASaddress,
    settings.NASport,
    settings.NASlogin,
    settings.NASpassword,
    settings.NAStempdir,
    settings.NASdir,
  ]);
}

async function getApiClient(): Promise<ApiClient> {
  const settings = await loadSettings();
  const signature = serializeSettings(settings);

  if (!clientCache || clientCache.signature !== signature) {
    clientCache = {
      signature,
      client: createApiClient({ settings, logger: apiLogger }),
    };
  }

  return clientCache.client;
}

function addLog(message: string): void {
  uiLogger.debug(message);
  if (!debugLoggingEnabled) return;
  const timestamp = new Date().toLocaleTimeString();
  debugLogs.push(`[${timestamp}] ${message}`);
  updateDebugDisplay();
}

function updateDebugDisplay(): void {
  if (!debugLoggingEnabled) return;
  const logsElement = document.getElementById("debug-logs");
  if (!logsElement) return;
  logsElement.textContent = debugLogs.join("\n");
  logsElement.scrollTop = logsElement.scrollHeight;
}

function setDebugLoggingEnabled(enabled: boolean): void {
  debugLoggingEnabled = enabled;
  uiLogger.setEnabled(enabled);
  apiLogger.setEnabled(enabled);

  const debugSection = document.querySelector(".debug-section");
  if (debugSection) {
    debugSection.classList.toggle("hidden", !enabled);
  }

  if (!enabled) {
    debugLogs = [];
    const logsElement = document.getElementById("debug-logs");
    if (logsElement) logsElement.textContent = "";
  } else {
    updateDebugDisplay();
  }
}

function formatRate(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  let value = bytesPerSecond;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const precision = unit === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unit]}`;
}

function updateToolbarState(): void {
  const removeBtn = document.getElementById("toolbar-remove") as HTMLButtonElement | null;
  if (removeBtn) {
    removeBtn.disabled = !selectedHash;
    removeBtn.setAttribute("aria-disabled", removeBtn.disabled ? "true" : "false");
  }
}

function refreshSelectionUI(): void {
  const items = document.querySelectorAll(".download-item");
  items.forEach((node) => {
    const item = node as HTMLElement;
    const hash = item.getAttribute("data-hash");
    const isSelected = !!selectedHash && hash === selectedHash;
    item.classList.toggle("selected", isSelected);
    item.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
  updateToolbarState();
}

function setSelectedHash(hash: string | null): void {
  selectedHash = hash;
  refreshSelectionUI();

  if (hash) {
    const selector = `.download-item[data-hash="${hash.replace(/["\\]/g, "\\$&")}"]`;
    const selectedItem = document.querySelector<HTMLElement>(selector);
    selectedItem?.focus({ preventScroll: false });
  }
}

function findDownloadItem(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  return target.closest(".download-item");
}

function toggleSelectionForItem(item: HTMLElement | null): void {
  if (!item) return;
  const hash = item.getAttribute("data-hash");
  if (!hash) return;
  setSelectedHash(selectedHash === hash ? null : hash);
}

async function refreshSnapshot(client: ApiClient): Promise<void> {
  const raw = await client.queryTasksRaw();
  const list: any[] = Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw?.tasks)
    ? raw.tasks
    : [];
  snapshot = buildTaskSnapshot(list);
}

function buildTaskSnapshot(tasks: any[]): { hashes: Set<string>; names: Set<string> } {
  const hashes = new Set<string>();
  const names = new Set<string>();

  tasks.forEach((task) => {
    const hash = task?.hash ?? task?.bt_hash ?? task?.id ?? null;
    if (hash) hashes.add(String(hash).toLowerCase());

    [task?.name, task?.title, task?.source, task?.source_name, task?.filename]
      .filter(Boolean)
      .forEach((value) => {
        const normalized = String(value)
          .replace(/\.torrent$/i, "")
          .replace(/\[[^\]]*\]/g, "")
          .replace(/[._-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        if (normalized) names.add(normalized);
      });
  });

  return { hashes, names };
}

function updateStatusSpeed(tasks: Task[]): void {
  const totalDown = tasks.reduce((sum, task) => sum + (task.downSpeedBps || 0), 0);
  const totalUp = tasks.reduce((sum, task) => sum + (task.upSpeedBps || 0), 0);
  const speedElement = document.getElementById("status-speed");
  if (speedElement) {
    speedElement.textContent = `↓ ${formatRate(totalDown)} ↑ ${formatRate(totalUp)}`;
  }
}

async function listDownloads(): Promise<void> {
  if (listAbortController) {
    listAbortController.abort();
  }

  const controller = new AbortController();
  listAbortController = controller;

  try {
    addLog("Fetching downloads...");
    const client = await getApiClient();
    const { raw, tasks } = await client.queryTasks({ signal: controller.signal });

    const listElement = document.getElementById("downloads-list");
    const section = document.getElementById("downloads-section");
    if (!listElement || !section) return;

    const html = renderDownloadsList(tasks);
    morphDOMUpdateList(listElement, html);
    section.classList.remove("hidden");

    snapshot = buildTaskSnapshot(
      Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.tasks) ? raw.tasks : []
    );

    updateStatusSpeed(tasks);

    addLog(tasks.length === 0 ? "No active downloads" : `Found ${tasks.length} download(s)`);
    refreshSelectionUI();
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") {
      uiLogger.debug("Download list request aborted");
      return;
    }
    showStatus(`Failed to list downloads: ${error}`, "error");
  } finally {
    if (listAbortController === controller) {
      listAbortController = null;
    }
  }
}

async function uploadTorrent(): Promise<void> {
  let currentFileName = "";
  const fileInput = document.getElementById("torrentFileInput") as HTMLInputElement | null;
  try {
    const file = fileInput?.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".torrent")) {
      showStatus("Please select a valid .torrent file", "error");
      return;
    }

    currentFileName = file.name;
    addLog(`Uploading torrent file: ${file.name}`);
    showStatus(`Uploading torrent: ${file.name}...`, "info");

    const client = await getApiClient();
    if (snapshot.names.size === 0 && snapshot.hashes.size === 0) {
      await refreshSnapshot(client);
    }

    const normalizedName = file.name
      .replace(/\.torrent$/i, "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    if (snapshot.names.has(normalizedName)) {
      showStatus(`"${file.name}" already exists on Download Station`, "info");
      fileInput!.value = "";
      return;
    }

    const result = await client.addTorrent(file);

    if (result.added) {
      showStatus("Torrent added successfully!", "success");
      fileInput!.value = "";
      setTimeout(() => {
        listDownloads().catch((error) => addLog(`Auto refresh after upload failed: ${error}`));
      }, 1000);
      return;
    }

    if (result.duplicate) {
      showStatus(`"${file.name}" already exists on Download Station`, "info");
      fileInput!.value = "";
      return;
    }

    if (result.unsupported) {
      showStatus("Upload failed. Torrent may already exist or NAS lacks this API.", "info");
      fileInput!.value = "";
      return;
    }

    showStatus("Failed to add torrent", "error");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showStatus(`Error: ${message}`, "error");
    addLog(`Upload error: ${message}`);
  } finally {
    if (fileInput) fileInput.value = "";
  }
}

async function removeDownload(hash: string): Promise<void> {
  try {
    const client = await getApiClient();
    await client.removeTask(hash);
    showStatus("Download removed", "success");
    await listDownloads();
  } catch (error) {
    showStatus(`Failed to remove download: ${error}`, "error");
  }
}

async function restoreOptions(): Promise<void> {
  try {
    const settings = await loadSettings();

    const elements = {
      NASsecure: document.getElementById("NASsecure") as HTMLInputElement,
      NASaddress: document.getElementById("NASaddress") as HTMLInputElement,
      NASport: document.getElementById("NASport") as HTMLInputElement,
      NASlogin: document.getElementById("NASlogin") as HTMLInputElement,
      NASpassword: document.getElementById("NASpassword") as HTMLInputElement,
      NAStempdir: document.getElementById("NAStempdir") as HTMLInputElement,
      NASdir: document.getElementById("NASdir") as HTMLInputElement,
      enableDebug: document.getElementById("enableDebug") as HTMLInputElement,
    };

    if (elements.NASsecure) elements.NASsecure.checked = settings.NASsecure;
    if (elements.NASaddress) elements.NASaddress.value = settings.NASaddress;
    if (elements.NASport) elements.NASport.value = settings.NASport;
    if (elements.NASlogin) elements.NASlogin.value = settings.NASlogin;
    if (elements.NASpassword) elements.NASpassword.value = settings.NASpassword;
    if (elements.NAStempdir) elements.NAStempdir.value = settings.NAStempdir;
    if (elements.NASdir) elements.NASdir.value = settings.NASdir;
    if (elements.enableDebug) elements.enableDebug.checked = settings.enableDebugLogging;

    setDebugLoggingEnabled(settings.enableDebugLogging);
    addLog("Settings loaded");
  } catch (error) {
    showStatus(`Failed to load settings: ${error}`, "error");
  }
}

async function saveOptions(e: Event): Promise<void> {
  e.preventDefault();

  try {
    const settings = {
      NASsecure: (document.getElementById("NASsecure") as HTMLInputElement)?.checked ?? false,
      NASaddress: (document.getElementById("NASaddress") as HTMLInputElement)?.value ?? "",
      NASport: (document.getElementById("NASport") as HTMLInputElement)?.value ?? "",
      NASlogin: (document.getElementById("NASlogin") as HTMLInputElement)?.value ?? "",
      NASpassword: (document.getElementById("NASpassword") as HTMLInputElement)?.value ?? "",
      NAStempdir: (document.getElementById("NAStempdir") as HTMLInputElement)?.value ?? "",
      NASdir: (document.getElementById("NASdir") as HTMLInputElement)?.value ?? "",
      enableDebugLogging: (document.getElementById("enableDebug") as HTMLInputElement)?.checked ?? false,
    } satisfies Settings;

    await saveSettings(settings);
    clientCache = null;
    setDebugLoggingEnabled(settings.enableDebugLogging);
    showStatus("Settings saved successfully", "success");
  } catch (error) {
    showStatus(`Failed to save settings: ${error}`, "error");
  }
}

async function testConnection(): Promise<void> {
  try {
    const settings = await loadSettings();
    showStatus("Testing connection...", "info");

    const client = createApiClient({ settings, logger: apiLogger });
    const isConnected = await client.testConnection();

    if (isConnected) {
      showStatus("Connection successful!", "success");
    } else {
      showStatus("Connection failed. Check settings and try again.", "error");
    }
  } catch (error) {
    showStatus(`Connection error: ${error}`, "error");
  }
}

function startAutoRefresh(): void {
  if (refreshInterval) return;
  refreshInterval = setInterval(() => {
    addLog("Auto-refreshing downloads...");
    listDownloads().catch((error) => {
      addLog(`Auto-refresh failed: ${error}`);
    });
  }, 5000);
  addLog("Auto-refresh enabled");
}

function stopAutoRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    addLog("Auto-refresh paused");
  }

  if (listAbortController) {
    listAbortController.abort();
    listAbortController = null;
  }
}

function showStatus(message: string, type: "success" | "error" | "info" = "info"): void {
  const statusPill = document.getElementById("status");
  const statusMessage = document.getElementById("status-message");

  if (statusPill && statusMessage) {
    statusMessage.textContent = message;
    if (message) {
      statusPill.className = `status-pill visible status-${type}`;
    } else {
      statusPill.className = "status-pill";
    }
  }

  addLog(message);
}

function copyLogs(): void {
  if (!debugLoggingEnabled) {
    showStatus("Enable debug logs to copy entries", "info");
    return;
  }
  const text = debugLogs.join("\n");
  navigator.clipboard.writeText(text).then(() => {
    showStatus("Logs copied to clipboard", "success");
  });
}

function clearLogs(): void {
  if (!debugLoggingEnabled) return;
  debugLogs = [];
  const logsElement = document.getElementById("debug-logs");
  if (logsElement) {
    logsElement.textContent = "";
  }
  showStatus("Logs cleared", "info");
}

function setupTabs(): void {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = (btn as HTMLElement).getAttribute("data-tab");
      if (!tabName) return;

      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const content = document.getElementById(`${tabName}-tab`);
      if (content) {
        content.classList.add("active");
      }
    });
  });
}

/**
 * Initialize popup on DOM ready
 */
document.addEventListener("DOMContentLoaded", async () => {
  addLog("Popup loaded");
  await restoreOptions();

  setupTabs();

  const saveBtn = document.getElementById("save-btn");
  const testBtn = document.getElementById("test-btn");
  const copyLogsBtn = document.getElementById("copy-logs-btn");
  const clearLogsBtn = document.getElementById("clear-logs-btn");
  const torrentInput = document.getElementById("torrentFileInput") as HTMLInputElement | null;
  const settingsPanel = document.getElementById("settings-panel");
  const toolbarSettings = document.getElementById("toolbar-settings") as HTMLButtonElement | null;
  const downloadsList = document.getElementById("downloads-list");
  const enableDebugCheckbox = document.getElementById("enableDebug") as HTMLInputElement | null;
  const toolbarPlay = document.getElementById("toolbar-play") as HTMLButtonElement | null;
  const toolbarStop = document.getElementById("toolbar-stop") as HTMLButtonElement | null;
  const toolbarPause = document.getElementById("toolbar-pause") as HTMLButtonElement | null;
  const toolbarRemove = document.getElementById("toolbar-remove") as HTMLButtonElement | null;
  const toolbarAdd = document.getElementById("toolbar-add") as HTMLButtonElement | null;

  saveBtn?.addEventListener("click", saveOptions);
  testBtn?.addEventListener("click", testConnection);
  copyLogsBtn?.addEventListener("click", copyLogs);
  clearLogsBtn?.addEventListener("click", clearLogs);
  torrentInput?.addEventListener("change", () => {
    uploadTorrent().catch((error) => {
      addLog(`Upload failed: ${error}`);
    });
  });

  enableDebugCheckbox?.addEventListener("change", () => {
    setDebugLoggingEnabled(enableDebugCheckbox.checked);
  });

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

  if (toolbarSettings && settingsPanel) {
    toolbarSettings.addEventListener("click", () => {
      const hidden = settingsPanel.classList.toggle("hidden");
      const expanded = !hidden;
      toolbarSettings.setAttribute("aria-pressed", expanded ? "true" : "false");
      toolbarSettings.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
  }

  toolbarPlay?.addEventListener("click", async () => {
    await listDownloads();
    startAutoRefresh();
  });

  toolbarPause?.addEventListener("click", () => {
    stopAutoRefresh();
  });

  toolbarStop?.addEventListener("click", () => {
    stopAutoRefresh();
  });

  toolbarRemove?.addEventListener("click", async () => {
    if (!selectedHash) {
      showStatus("Select a download to remove", "info");
      return;
    }
    const hashToRemove = selectedHash;
    await removeDownload(hashToRemove);
    setSelectedHash(null);
  });

  toolbarAdd?.addEventListener("click", () => {
    torrentInput?.click();
  });

  updateToolbarState();

  addLog("Auto-loading downloads...");
  await listDownloads();
  startAutoRefresh();

  window.addEventListener("beforeunload", () => {
    stopAutoRefresh();
  });
});
