type RefreshCallback = () => Promise<void>;
type LogCallback = (message: string) => void;

let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
let refreshCallback: RefreshCallback | null = null;
let log: LogCallback = () => {};

export function configureAutoRefresh(options: { onRefresh: RefreshCallback; onLog?: LogCallback }): void {
  refreshCallback = options.onRefresh;
  log = options.onLog ?? (() => {});
}

export function startAutoRefresh(intervalMs = 5000): void {
  if (refreshIntervalId || !refreshCallback) {
    if (refreshIntervalId) {
      log("Auto-refresh already running");
    }
    return;
  }

  refreshIntervalId = setInterval(() => {
    const now = new Date().toLocaleTimeString();
    log(`[${now}] Auto-refresh triggered`);
    refreshCallback?.().catch((error) => {
      log(`Auto-refresh failed: ${error}`);
    });
  }, intervalMs);
  log(`Auto-refresh enabled (interval: ${intervalMs / 1000}s)`);
}

export function stopAutoRefresh(): void {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
    log("Auto-refresh paused");
  }
}

export function isAutoRefreshRunning(): boolean {
  return refreshIntervalId !== null;
}
