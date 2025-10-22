import { setSelectionState, setSettingsButtonState } from "./toolbarState.js";
import { setupToolbarActions } from "./toolbarActions.js";
import type { DownloadsFeature } from "../downloads/index.js";
import type { SettingsFeature } from "../settings/index.js";
import type { UploadFeature } from "../upload/index.js";

interface InitializeToolbarOptions {
  downloads: DownloadsFeature;
  settings: SettingsFeature;
  upload: UploadFeature;
  onLog?: (message: string) => void;
}

export interface ToolbarFeature {
  updateSelectionState: () => void;
  setSettingsExpanded: (expanded: boolean) => void;
  dispose: () => void;
}

export function initializeToolbar(options: InitializeToolbarOptions): ToolbarFeature {
  const { downloads, settings, upload } = options;

  setupToolbarActions({
    downloads,
    settings,
    upload,
    onLog: options.onLog,
  });

  const unsubscribe = downloads.onSelectionChange((hash) => {
    setSelectionState(Boolean(hash));
  });

  setSelectionState(Boolean(downloads.getSelected()));
  setSettingsButtonState(settings.isPanelVisible());

  return {
    updateSelectionState: () => {
      setSelectionState(Boolean(downloads.getSelected()));
    },
    setSettingsExpanded: (expanded: boolean) => {
      setSettingsButtonState(expanded);
    },
    dispose: () => {
      unsubscribe();
    },
  };
}
