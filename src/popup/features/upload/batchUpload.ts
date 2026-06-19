import { showStatus } from "@/popup/components";

import { getApiClient } from "../../shared/api";
import { requestMonitoring } from "../../shared/monitor.js";

interface BatchOptions {
  targetFolder?: string;
  onSuccess?: () => void;
}

const MAX_URLS = 50;

/** Split a textarea blob into trimmed, non-empty URLs. */
export function parseUrlLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function uploadUrls(urls: string[], options: BatchOptions = {}): Promise<void> {
  if (urls.length === 0) {
    showStatus("Enter at least one URL", "error");
    return;
  }
  if (urls.length > MAX_URLS) {
    showStatus(`Too many URLs (max ${MAX_URLS})`, "error");
    return;
  }

  showStatus(`Adding ${urls.length} URL(s)…`, "info");

  try {
    const client = await getApiClient();
    const results = await client.addUrls(urls, { targetFolder: options.targetFolder });

    const ok = results.filter((r) => r.ok).length;
    const failed = results.length - ok;

    if (ok > 0) {
      requestMonitoring();
    }

    if (failed === 0) {
      showStatus(`Added ${ok} task(s)`, "success", { autoHideMs: 2000 });
      options.onSuccess?.();
      return;
    }

    if (ok > 0) {
      showStatus(`Added ${ok}, failed ${failed}`, "info", { autoHideMs: 3000 });
      options.onSuccess?.();
    } else {
      showStatus(`Failed to add ${failed} URL(s)`, "error");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showStatus(`Error: ${message}`, "error");
  }
}
