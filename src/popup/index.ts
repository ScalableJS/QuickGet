import { showStatus } from "@/popup/components";

import { initializeDebug } from "./features/debug";
import { type DownloadsFeature, initializeDownloads } from "./features/downloads";
import { initializeSettings } from "./features/settings";
import { initializeToolbar } from "./features/toolbar";
import { initializeUpload } from "./features/upload";
import { setDefaultClientLogger } from "./shared/api";

function handleInitializationError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  showStatus(`Popup initialization failed: ${message}`, "error");
}

document.addEventListener("DOMContentLoaded", async () => {
  const debug = initializeDebug();
  debug.log("Popup loaded");

  setDefaultClientLogger(debug.getApiLogger());

  let downloadsFeature: DownloadsFeature | null = null;

  try {
    const settings = await initializeSettings({
      onDebugToggle: (enabled) => {
        debug.setEnabled(enabled);
      },
      onVisibilityChange: (visible) => {
        if (visible) {
          downloadsFeature?.hideDownloads();
        } else {
          void downloadsFeature?.refreshNow({ silent: true }).catch((error) => {
            debug.log(`Refresh after settings close failed: ${error}`);
          });
        }
      },
    });

    const upload = initializeUpload({
      onLog: debug.log,
      onUploadSuccess: () => {
        void downloadsFeature?.refreshNow({ silent: true }).catch((error) => {
          debug.log(`Auto refresh after upload failed: ${error}`);
        });
      },
    });

    downloadsFeature = await initializeDownloads({
      onLog: debug.log,
    });

    initializeToolbar({
      downloads: downloadsFeature,
      settings,
      upload,
      onLog: debug.log,
    });

    debug.log("Popup initialized");
  } catch (error) {
    handleInitializationError(error);
    debug.log(`Initialization error: ${error}`);
  }
});
