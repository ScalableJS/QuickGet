import { mount } from "svelte";
import { showStatus } from "@/popup/components";

import type { DownloadsFeature } from "../downloads";
import type { SettingsFeature } from "../settings";
import type { UploadFeature } from "../upload";

import Toolbar from "./Toolbar.svelte";
import { toolbarView } from "./toolbarView.svelte.js";

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
  const log = options.onLog ?? ((_message: string) => {});

  const requireSelection = (verb: string): string | null => {
    const selected = downloads.getSelected();
    if (!selected) {
      showStatus(`Select a torrent to ${verb}`, "info", { autoHideMs: 2000 });
      return null;
    }
    return selected;
  };

  const actions = {
    start: () => {
      const hash = requireSelection("start");
      if (hash) void downloads.start(hash);
    },
    stop: () => {
      const hash = requireSelection("stop");
      if (hash) void downloads.stop(hash);
    },
    pause: () => {
      const hash = requireSelection("pause");
      if (hash) void downloads.pause(hash);
    },
    remove: () => {
      const hash = requireSelection("remove");
      if (!hash) return;
      void downloads.remove(hash).then(() => downloads.clearSelection());
    },
    add: () => upload.triggerFilePicker(),
    toggleSettings: () => {
      toolbarView.settingsExpanded = settings.togglePanel();
    },
  };

  const header = document.querySelector(".toolbar") as HTMLElement | null;
  if (header) {
    header.replaceChildren();
    mount(Toolbar, { target: header, props: { actions } });
  }

  toolbarView.hasSelection = Boolean(downloads.getSelected());
  toolbarView.settingsExpanded = settings.isPanelVisible();

  const unsubscribe = downloads.onSelectionChange((hash) => {
    toolbarView.hasSelection = Boolean(hash);
  });

  log("Toolbar initialized");

  return {
    updateSelectionState: () => {
      toolbarView.hasSelection = Boolean(downloads.getSelected());
    },
    setSettingsExpanded: (expanded: boolean) => {
      toolbarView.settingsExpanded = expanded;
    },
    dispose: () => {
      unsubscribe();
    },
  };
}
