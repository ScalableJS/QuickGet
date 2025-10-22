import type { Logger } from "@lib/logger.js";
import { showStatus } from "../../components/statusPill/index.js";
import {
  addDebugLog,
  setDebugLoggingEnabled,
  isDebugLoggingEnabled,
  getDebugLogs,
  getApiLogger as fetchApiLogger,
  getUiLogger as fetchUiLogger,
} from "./debugLogger.js";
import { setupDebugPanel } from "./debugUI.js";

export interface DebugFeature {
  log: (message: string) => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: () => boolean;
  getLogs: () => string[];
  getUiLogger: () => Logger;
  getApiLogger: () => Logger;
}

export function initializeDebug(): DebugFeature {
  setupDebugPanel({
    onCopySuccess: () => showStatus("Logs copied to clipboard", "success", { autoHideMs: 2000 }),
    onCopyError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      showStatus(message, "info", { autoHideMs: 2000 });
    },
    onClear: () => showStatus("Logs cleared", "info", { autoHideMs: 2000 }),
  });

  return {
    log: (message: string) => addDebugLog(message),
    setEnabled: (enabled: boolean) => setDebugLoggingEnabled(enabled),
    isEnabled: () => isDebugLoggingEnabled(),
    getLogs: () => getDebugLogs(),
    getUiLogger: () => fetchUiLogger(),
    getApiLogger: () => fetchApiLogger(),
  };
}
