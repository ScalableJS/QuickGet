import { resolveDestination } from "@lib/routingRules.js";
import { getErrorMessage } from "@lib/errors.js";
import { loadSettings } from "@lib/settings.js";
import { readTorrentName } from "@lib/torrentMeta.js";
import { isCurrentDirectStatus, showStatus } from "@/popup/components";

import { getApiClient } from "../../shared/api";
import { requestMonitoring } from "../../shared/monitor.js";

import { reportFollowUpFailure } from "./uploadFeedback.js";

type UploadOptions = {
  onDuplicate?: (fileName: string) => void | Promise<void>;
  onSuccess?: () => void | Promise<void>;
};

export async function uploadTorrent(file: File, options: UploadOptions = {}): Promise<void> {
  if (!file.name.toLowerCase().endsWith(".torrent")) {
    showStatus("Please select a valid .torrent file", "error");
    return;
  }

  const receipt = showStatus(`Uploading torrent: ${file.name}...`, "info");

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
      const message = `Added "${file.name}" to Download Station`;
      if (isCurrentDirectStatus(receipt)) {
        const terminalReceipt = showStatus(message, "success", { autoHideMs: 2500 });
        await reportFollowUpFailure(terminalReceipt, message, options.onSuccess);
      }
      return;
    }

    if (result.duplicate) {
      const message = `"${file.name}" already exists on Download Station`;
      if (isCurrentDirectStatus(receipt)) {
        const terminalReceipt = showStatus(message, "info", { autoHideMs: 2000 });
        await reportFollowUpFailure(terminalReceipt, message, () => options.onDuplicate?.(file.name));
      }
      return;
    }

    if (isCurrentDirectStatus(receipt)) showStatus("Failed to add torrent", "error");
  } catch (error) {
    if (isCurrentDirectStatus(receipt)) showStatus(`Error: ${getErrorMessage(error)}`, "error");
  }
}
