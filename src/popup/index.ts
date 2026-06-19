import { getErrorMessage } from "@lib/errors.js";
import { showStatus } from "@/popup/components";
import { isLocked } from "@lib/settings.js";
import { type DownloadsFeature, initializeDownloads } from "./features/downloads";
import { initializeSettings } from "./features/settings";
import { initializeToolbar } from "./features/toolbar";
import { initializeUpload } from "./features/upload";
import { initializeUnlock } from "./features/unlock";

function handleInitializationError(error: unknown): void {
  showStatus(`Popup initialization failed: ${getErrorMessage(error)}`, "error");
}

document.addEventListener("DOMContentLoaded", async () => {
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
          void runMainInit();
        },
      });
      unlockFeature.showPanel();
    } else {
      void runMainInit();
    }
  } catch (error) {
    handleInitializationError(error);
  }
});

async function runMainInit(): Promise<void> {
  let downloadsFeature: DownloadsFeature | null = null;

  try {
    const settings = await initializeSettings({
      onVisibilityChange: (visible) => {
        if (visible) {
          downloadsFeature?.hideDownloads();
        } else {
          void downloadsFeature?.refreshNow();
        }
      },
    });

    const upload = initializeUpload({
      onUploadSuccess: () => {
        void downloadsFeature?.refreshNow();
      },
    });

    downloadsFeature = await initializeDownloads();

    initializeToolbar({
      downloads: downloadsFeature,
      settings,
      upload,
    });
  } catch (error) {
    handleInitializationError(error);
  }
}
