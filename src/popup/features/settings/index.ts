import { mount } from "svelte";

import SettingsPanel from "./Settings.svelte";
import { getSettingsPanel, isSettingsPanelVisible } from "./settingsUI.js";

type InitializeSettingsOptions = {
  onVisibilityChange?: (visible: boolean) => void;
};

export type SettingsFeature = {
  togglePanel: () => boolean;
  isPanelVisible: () => boolean;
};

export async function initializeSettings(options: InitializeSettingsOptions = {}): Promise<SettingsFeature> {
  const panel = getSettingsPanel();
  if (panel) {
    panel.replaceChildren();
    const settingsPanel = mount(SettingsPanel, {
      target: panel,
    });
    await settingsPanel.load();
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
