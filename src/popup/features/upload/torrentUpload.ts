import { resolveDestination } from "@lib/routingRules.js";
import { loadSettings } from "@lib/settings.js";
import { readTorrentName } from "@lib/torrentMeta.js";
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
    // A file dropped here is the same torrent as one clicked on a tracker, so it must obey the
    // same rules. There is no URL and no page, but the release name is inside the file — which
    // is what a rule matches on anyway.
    const settings = await loadSettings();
    const targetFolder = resolveDestination(
      { url: file.name, kind: "torrent", name: readTorrentName(new Uint8Array(await file.arrayBuffer())) },
      settings.routingRules,
      settings.NASdir,
    );

    const client = await getApiClient();
    const result = await client.addTorrent(file, { targetFolder });

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
