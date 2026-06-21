type RefreshCallback = () => Promise<void>;

let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
let refreshCallback: RefreshCallback | null = null;

export function configureAutoRefresh(options: { onRefresh: RefreshCallback }): void {
  refreshCallback = options.onRefresh;
}

// 2s keeps progress/speed visibly live while the popup is open. The popup is a
// normal page (not the MV3 service worker), so it isn't subject to the 30s
// alarm floor — it can poll as often as is comfortable for the NAS.
export function startAutoRefresh(intervalMs = 2000): void {
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
