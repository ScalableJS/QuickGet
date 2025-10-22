import { createLogger, type Logger } from "@lib/logger.js";

type LogsListener = (logs: string[]) => void;
type EnabledListener = (enabled: boolean) => void;

const uiLogger = createLogger("Popup", { enabled: false });
const apiLogger = createLogger("QNAP", { enabled: false });

let debugLoggingEnabled = false;
let debugLogs: string[] = [];

const logsListeners = new Set<LogsListener>();
const enabledListeners = new Set<EnabledListener>();

function notifyLogs(): void {
  const snapshot = [...debugLogs];
  logsListeners.forEach((listener) => listener(snapshot));
}

function notifyEnabled(): void {
  enabledListeners.forEach((listener) => listener(debugLoggingEnabled));
}

export function addDebugLog(message: string): void {
  uiLogger.debug(message);
  if (!debugLoggingEnabled) return;
  const timestamp = new Date().toLocaleTimeString();
  debugLogs.push(`[${timestamp}] ${message}`);
  notifyLogs();
}

export function clearDebugLogs(): void {
  if (!debugLoggingEnabled) return;
  debugLogs = [];
  notifyLogs();
}

export function getDebugLogs(): string[] {
  return [...debugLogs];
}

export function copyDebugLogs(): Promise<void> {
  if (!debugLoggingEnabled) {
    return Promise.reject(new Error("Debug logging disabled"));
  }
  const text = debugLogs.join("\n");
  return navigator.clipboard.writeText(text);
}

export function setDebugLoggingEnabled(enabled: boolean): void {
  if (debugLoggingEnabled === enabled) return;
  debugLoggingEnabled = enabled;

  if ("setEnabled" in uiLogger) {
    uiLogger.setEnabled(enabled);
  }
  if ("setEnabled" in apiLogger) {
    apiLogger.setEnabled(enabled);
  }

  if (!enabled) {
    debugLogs = [];
    notifyLogs();
  } else {
    notifyLogs();
  }

  notifyEnabled();
}

export function isDebugLoggingEnabled(): boolean {
  return debugLoggingEnabled;
}

export function onDebugLogs(listener: LogsListener): () => void {
  logsListeners.add(listener);
  listener([...debugLogs]);
  return () => logsListeners.delete(listener);
}

export function onDebugEnabledChange(listener: EnabledListener): () => void {
  enabledListeners.add(listener);
  listener(debugLoggingEnabled);
  return () => enabledListeners.delete(listener);
}

export function getUiLogger(): Logger {
  return uiLogger;
}

export function getApiLogger(): Logger {
  return apiLogger;
}
