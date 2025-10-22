import {
  onDebugLogs,
  onDebugEnabledChange,
  copyDebugLogs,
  clearDebugLogs,
  isDebugLoggingEnabled,
} from "./debugLogger.js";

interface DebugUIOptions {
  onCopySuccess?: () => void;
  onCopyError?: (error: unknown) => void;
  onClear?: () => void;
}

let debugSection: HTMLElement | null = null;
let logsElement: HTMLElement | null = null;
let copyButton: HTMLButtonElement | null = null;
let clearButton: HTMLButtonElement | null = null;

function ensureElements(): void {
  if (!debugSection) {
    debugSection = document.querySelector(".debug-section") as HTMLElement | null;
  }
  if (!logsElement) {
    logsElement = document.getElementById("debug-logs");
  }
  if (!copyButton) {
    copyButton = document.getElementById("copy-logs-btn") as HTMLButtonElement | null;
  }
  if (!clearButton) {
    clearButton = document.getElementById("clear-logs-btn") as HTMLButtonElement | null;
  }
}

function updateDebugVisibility(enabled: boolean): void {
  ensureElements();
  if (debugSection) {
    debugSection.classList.toggle("hidden", !enabled);
  }
}

function updateLogsDisplay(logs: string[]): void {
  ensureElements();
  if (!logsElement) return;
  logsElement.textContent = logs.join("\n");
  logsElement.scrollTop = logsElement.scrollHeight;
}

export function setupDebugPanel(options: DebugUIOptions = {}): void {
  ensureElements();

  onDebugEnabledChange((enabled) => {
    updateDebugVisibility(enabled);
  });

  onDebugLogs((logs) => {
    updateLogsDisplay(logs);
  });

  copyButton?.addEventListener("click", () => {
    if (!isDebugLoggingEnabled()) {
      options.onCopyError?.(new Error("Enable debug logs to copy entries"));
      return;
    }
    copyDebugLogs()
      .then(() => {
        options.onCopySuccess?.();
      })
      .catch((error) => {
        options.onCopyError?.(error);
      });
  });

  clearButton?.addEventListener("click", () => {
    if (!isDebugLoggingEnabled()) return;
    clearDebugLogs();
    options.onClear?.();
  });
}
