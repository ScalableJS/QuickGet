import { showStatus } from "@/popup/components";

import { getApiClient } from "../../shared/api";
import { requestMonitoring } from "../../shared/monitor.js";

interface UploadOptions {
  onDuplicate?: (fileName: string) => void;
  onSuccess?: () => void;
}

export async function uploadTorrent(file: File, options: UploadOptions = {}): Promise<void> {
  if (!file.name.toLowerCase().endsWith(".torrent")) {
    showStatus("Please select a valid .torrent file", "error");
    return;
  }

  showStatus(`Uploading torrent: ${file.name}...`, "info");

  try {
    const client = await getApiClient();
    const result = await client.addTorrent(file);

    if (result.added) {
      requestMonitoring();
      options.onSuccess?.();
      return;
    }

    if (result.duplicate) {
      showStatus(`"${file.name}" already exists on Download Station`, "info", { autoHideMs: 2000 });
      options.onDuplicate?.(file.name);
      return;
    }

    showStatus("Failed to add torrent", "error");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showStatus(`Error: ${message}`, "error");
  }
}
