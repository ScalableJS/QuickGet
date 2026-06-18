import { mount } from "svelte";

import SettingsPanel from "./Settings.svelte";
import { getSettingsPanel, isSettingsPanelVisible } from "./settingsUI.js";

type InitializeSettingsOptions = {
  onDebugToggle?: (enabled: boolean) => void;
  onVisibilityChange?: (visible: boolean) => void;
};

export type SettingsFeature = {
  togglePanel: () => boolean;
  isPanelVisible: () => boolean;
};

export function initializeSettings(options: InitializeSettingsOptions = {}): SettingsFeature {
  const panel = getSettingsPanel();
  if (panel) {
    panel.replaceChildren();
    // Settings.svelte loads on mount and saves via its own buttons — no parent-driven lifecycle.
    mount(SettingsPanel, {
      target: panel,
      props: { onDebugToggle: options.onDebugToggle },
    });
  }

  return {
    togglePanel: () => toggleSettingsPanel(options.onVisibilityChange),
    isPanelVisible: () => isSettingsPanelVisible(),
  };
}

function toggleSettingsPanel(onVisibilityChange?: (visible: boolean) => void): boolean {
  const panel = getSettingsPanel();
  if (!panel) return false;
  const hidden = panel.classList.toggle("hidden");
  const visible = !hidden;
  onVisibilityChange?.(visible);
  return visible;
}
