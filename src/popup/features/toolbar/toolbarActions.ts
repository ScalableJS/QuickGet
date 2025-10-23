import { showStatus } from "../../components/statusPill/index.js";
import type { DownloadsFeature } from "../downloads/index.js";
import type { SettingsFeature } from "../settings/index.js";
import type { UploadFeature } from "../upload/index.js";
import { getToolbarElements, setSelectionState, setSettingsButtonState } from "./toolbarState.js";

interface ToolbarActionsOptions {
  downloads: DownloadsFeature;
  settings: SettingsFeature;
  upload: UploadFeature;
}

export function setupToolbarActions({ downloads, settings, upload }: ToolbarActionsOptions): void {
  const { play, stop, remove, add, pause, settings: settingsBtn } = getToolbarElements();

  play?.addEventListener("click", async () => {
    const selected = downloads.getSelected();
    if (!selected) {
      showStatus("Select a torrent to start", "info", { autoHideMs: 2000 });
      return;
    }
    await downloads.start(selected);
  });

  stop?.addEventListener("click", async () => {
    const selected = downloads.getSelected();
    if (!selected) {
      showStatus("Select a torrent to stop", "info", { autoHideMs: 2000 });
      return;
    }
    await downloads.stop(selected);
  });

  pause?.addEventListener("click", async () => {
    const selected = downloads.getSelected();
    if (!selected) {
      showStatus("Select a torrent to pause", "info", { autoHideMs: 2000 });
      return;
    }
    await downloads.pause(selected);
  });

  remove?.addEventListener("click", async () => {
    const selected = downloads.getSelected();
    if (!selected) {
      showStatus("Select a download to remove", "info", { autoHideMs: 2000 });
      return;
    }
    await downloads.remove(selected);
    downloads.clearSelection();
    setSelectionState(false);
  });

  add?.addEventListener("click", () => {
    upload.triggerFilePicker();
  });

  settingsBtn?.addEventListener("click", () => {
    const visible = settings.togglePanel();
    setSettingsButtonState(visible);
  });

  setSelectionState(false);
}
