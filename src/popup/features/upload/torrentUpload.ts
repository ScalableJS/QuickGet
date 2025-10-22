import { showStatus } from "../../components/statusPill/index.js";
import { getApiClient } from "../../shared/api/index.js";
import { refreshSnapshot } from "../downloads/downloadsManager.js";
import { getSnapshot } from "../downloads/downloadsState.js";
import { checkDuplicate, normalizeFileName } from "./duplicateCheck.js";

interface UploadOptions {
  log?: (message: string) => void;
  onDuplicate?: (fileName: string) => void;
  onSuccess?: () => void;
}

function defaultLog(message: string): void {
  console.debug(`[Upload] ${message}`);
}

export async function uploadTorrent(file: File, options: UploadOptions = {}): Promise<void> {
  const log = options.log ?? defaultLog;

  if (!file.name.toLowerCase().endsWith(".torrent")) {
    showStatus("Please select a valid .torrent file", "error");
    return;
  }

  log(`Uploading torrent file: ${file.name}`);
  showStatus(`Uploading torrent: ${file.name}...`, "info");

  let snapshot = getSnapshot();
  if (snapshot.names.size === 0 && snapshot.hashes.size === 0) {
    await refreshSnapshot();
    snapshot = getSnapshot();
  }

  const normalizedName = normalizeFileName(file.name);
  if (checkDuplicate(file.name) || (normalizedName && snapshot.names.has(normalizedName))) {
    showStatus(`"${file.name}" already exists on Download Station`, "info", { autoHideMs: 2000 });
    options.onDuplicate?.(file.name);
    return;
  }

  try {
    const client = await getApiClient();
    const result = await client.addTorrent(file);

    if (result.added) {
      showStatus("Torrent added successfully!", "success", { autoHideMs: 2000 });
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
    log(`Upload error: ${message}`);
  }
}
