import type { Settings } from "@lib/config.js";
import { loadSettings } from "@lib/settings.js";
import { mount } from "svelte";

import SettingsPanel from "./Settings.svelte";
import { getSettingsPanel, hideSettingsPanel, isSettingsPanelVisible, showSettingsPanel } from "./settingsUI.js";

interface InitializeSettingsOptions {
  onDebugToggle?: (enabled: boolean) => void;
  onVisibilityChange?: (visible: boolean) => void;
}

export interface SettingsFeature {
  restore: () => Promise<void>;
  save: () => Promise<void>;
  togglePanel: () => boolean;
  openPanel: () => void;
  closePanel: () => void;
  isPanelVisible: () => boolean;
  getCurrentSettings: () => Promise<Settings>;
}

function toggleSettingsPanel(onVisibilityChange?: (visible: boolean) => void): boolean {
  const panel = getSettingsPanel();
  if (!panel) return false;
  const hidden = panel.classList.toggle("hidden");
  const visible = !hidden;
  onVisibilityChange?.(visible);
  return visible;
}

export async function initializeSettings(options: InitializeSettingsOptions = {}): Promise<SettingsFeature> {
  const panel = getSettingsPanel();
  let app: { load: () => Promise<void>; save: () => Promise<void> } | null = null;

  if (panel) {
    panel.replaceChildren();
    app = mount(SettingsPanel, {
      target: panel,
      props: { onDebugToggle: options.onDebugToggle },
    }) as unknown as { load: () => Promise<void>; save: () => Promise<void> };
  }

  return {
    restore: () => app?.load() ?? Promise.resolve(),
    save: () => app?.save() ?? Promise.resolve(),
    togglePanel: () => toggleSettingsPanel(options.onVisibilityChange),
    openPanel: () => {
      showSettingsPanel();
      options.onVisibilityChange?.(true);
    },
    closePanel: () => {
      hideSettingsPanel();
      options.onVisibilityChange?.(false);
    },
    isPanelVisible: () => isSettingsPanelVisible(),
    getCurrentSettings: () => loadSettings(),
  };
}
