import "virtual:uno.css";
import "./styles/tokens.css";
import "./styles/base.css";

import { applyTheme } from "@lib/applyTheme.js";
import { getErrorMessage } from "@lib/errors.js";
import { showStatus } from "@/popup/components";
import { loadSettings } from "@lib/settings.js";
import { type DownloadsFeature, initializeDownloads } from "./features/downloads";
import { initializeSettings } from "./features/settings";
import { initializeToolbar } from "./features/toolbar";
import { initializeUpload } from "./features/upload";
import { ACKNOWLEDGE_ATTENTION_MESSAGE, type AttentionResponse } from "../background/attentionMessage.js";

function handleInitializationError(error: unknown): void {
  showStatus(`Popup initialization failed: ${getErrorMessage(error)}`, "error");
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Apply the saved theme as early as possible to avoid a flash of the default.
    try {
      const { theme } = await loadSettings();
      applyTheme(theme);
    } catch {
      // Non-fatal — fall back to the default :root (dark) theme.
    }

    // The popup always opens. The optional password guards the settings screen only — the
    // task list and the toolbar were never what it was protecting, and hiding them made the
    // extension look broken to a user who had simply restarted their browser.
    void runMainInit();
  } catch (error) {
    handleInitializationError(error);
  }
});

async function runMainInit(): Promise<void> {
  let downloadsFeature: DownloadsFeature | null = null;

  try {
    const attention = await acknowledgeToolbarAttention();
    if (attention?.reason) showStatus(attention.reason, "error");

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

async function acknowledgeToolbarAttention(): Promise<AttentionResponse | null> {
  try {
    return await chrome.runtime.sendMessage<unknown, AttentionResponse>({
      type: ACKNOWLEDGE_ATTENTION_MESSAGE,
    });
  } catch {
    // A popup must remain usable if the service worker is still starting or being reloaded.
    return null;
  }
}
