import { getErrorMessage } from "@lib/errors.js";
import { showStatus } from "@/popup/components";
import { isLocked } from "@lib/settings.js";
import { initializeDebug } from "./features/debug";
import { type DownloadsFeature, initializeDownloads } from "./features/downloads";
import { initializeSettings } from "./features/settings";
import { initializeToolbar } from "./features/toolbar";
import { initializeUpload } from "./features/upload";
import { initializeUnlock } from "./features/unlock";
import { setDefaultClientLogger } from "./shared/api";

function handleInitializationError(error: unknown): void {
  showStatus(`Popup initialization failed: ${getErrorMessage(error)}`, "error");
}

document.addEventListener("DOMContentLoaded", async () => {
  const debug = initializeDebug();
  debug.log("Popup loaded");

  setDefaultClientLogger(debug.getApiLogger());

  try {
    const locked = await isLocked();
    if (locked) {
      // Hide toolbar and downloads list on startup
      const toolbarEl = document.querySelector(".toolbar");
      const downloadsEl = document.getElementById("downloads-section");
      toolbarEl?.classList.add("hidden");
      downloadsEl?.classList.add("hidden");

      const unlockFeature = initializeUnlock({
        onUnlock: () => {
          unlockFeature.hidePanel();
          toolbarEl?.classList.remove("hidden");
          downloadsEl?.classList.remove("hidden");
          void runMainInit(debug);
        },
      });
      unlockFeature.showPanel();
      debug.log("Popup is locked, displaying unlock panel");
    } else {
      void runMainInit(debug);
    }
  } catch (error) {
    handleInitializationError(error);
    debug.log(`Initialization error: ${error}`);
  }
});

async function runMainInit(debug: ReturnType<typeof initializeDebug>): Promise<void> {
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
}
