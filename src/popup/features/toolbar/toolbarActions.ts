import { showStatus } from "../../components/statusPill/index.js";
import type { DownloadsFeature } from "../downloads/index.js";
import type { SettingsFeature } from "../settings/index.js";
import type { UploadFeature } from "../upload/index.js";
import { getToolbarElements, setSelectionState, setSettingsButtonState } from "./toolbarState.js";

interface ToolbarActionsOptions {
  downloads: DownloadsFeature;
  settings: SettingsFeature;
  upload: UploadFeature;
  onLog?: (message: string) => void;
}

function logToolbarAction(action: string, log: (message: string) => void): void {
  const message = `[Toolbar] ${action}`;
  log(message);
}

export function setupToolbarActions(options: ToolbarActionsOptions): void {
  const { downloads, settings, upload } = options;
  const log = options.onLog ?? ((message: string) => console.debug(message));

  const { play, stop, remove, add, settings: settingsBtn, pause } = getToolbarElements();

  play?.addEventListener("click", async () => {
    const selected = downloads.getSelected();
    logToolbarAction("play", log);
    if (!selected) {
      showStatus("Select a torrent to start", "info", { autoHideMs: 2000 });
      return;
    }
    await downloads.start(selected);
  });

  stop?.addEventListener("click", async () => {
    const selected = downloads.getSelected();
    logToolbarAction("stop", log);
    if (!selected) {
      showStatus("Select a torrent to stop", "info", { autoHideMs: 2000 });
      return;
    }
    await downloads.stop(selected);
  });

  remove?.addEventListener("click", async () => {
    const selected = downloads.getSelected();
    logToolbarAction("remove", log);
    if (!selected) {
      showStatus("Select a download to remove", "info", { autoHideMs: 2000 });
      return;
    }
    await downloads.remove(selected);
    downloads.clearSelection();
    setSelectionState(false);
  });

  add?.addEventListener("click", () => {
    logToolbarAction("add", log);
    upload.triggerFilePicker();
  });

  pause?.addEventListener("click", async () => {
    const selected = downloads.getSelected();
    logToolbarAction("pause", log);
    if (!selected) {
      showStatus("Select a torrent to pause", "info", { autoHideMs: 2000 });
      return;
    }

    await downloads.pause(selected);
  });

  settingsBtn?.addEventListener("click", () => {
    logToolbarAction("settings", log);
    const visible = settings.togglePanel();
    setSettingsButtonState(visible);
  });

  // Initialize selection state to disabled until selection happens.
  setSelectionState(false);
}
