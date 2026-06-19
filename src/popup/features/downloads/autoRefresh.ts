type RefreshCallback = () => Promise<void>;

let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
let refreshCallback: RefreshCallback | null = null;

export function configureAutoRefresh(options: { onRefresh: RefreshCallback }): void {
  refreshCallback = options.onRefresh;
}

export function startAutoRefresh(intervalMs = 5000): void {
  if (refreshIntervalId || !refreshCallback) {
    return;
  }

  refreshIntervalId = setInterval(() => {
    refreshCallback?.().catch(() => {});
  }, intervalMs);
}

export function stopAutoRefresh(): void {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}

export function isAutoRefreshRunning(): boolean {
  return refreshIntervalId !== null;
}
