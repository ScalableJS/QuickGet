import { getSettingsLockState } from "@lib/settingsLock.js";
import { mount } from "svelte";

import UnlockPanel from "../unlock/Unlock.svelte";

import SettingsPanel from "./Settings.svelte";
import { getSettingsPanel, isSettingsPanelVisible } from "./settingsUI.js";

type InitializeSettingsOptions = {
  onVisibilityChange?: (visible: boolean) => void;
  onConnectionSaved?: () => void;
};

export type SettingsFeature = {
  togglePanel: () => boolean;
  isPanelVisible: () => boolean;
};

export async function initializeSettings(options: InitializeSettingsOptions = {}): Promise<SettingsFeature> {
  const panel = getSettingsPanel();
  if (!panel) {
    return {
      togglePanel: () => toggleSettingsPanel(options.onVisibilityChange),
      isPanelVisible: () => isSettingsPanelVisible(),
    };
  }

  // The lock covers this screen only. Everything else in the popup — and every background
  // download — carries on regardless of whether it has been unlocked.
  const lock = await getSettingsLockState();

  if (lock.enabled && !lock.unlocked) {
    panel.replaceChildren();
    mount(UnlockPanel, {
      target: panel,
      props: { onUnlock: () => void mountSettings(panel, options.onConnectionSaved) },
    });
  } else {
    await mountSettings(panel, options.onConnectionSaved);
  }

  return {
    togglePanel: () => toggleSettingsPanel(options.onVisibilityChange),
    isPanelVisible: () => isSettingsPanelVisible(),
  };
}

async function mountSettings(panel: HTMLElement, onConnectionSaved?: () => void): Promise<void> {
  panel.replaceChildren();
  const settingsPanel = mount(SettingsPanel, { target: panel, props: { onConnectionSaved } });
  await settingsPanel.load();
}

function toggleSettingsPanel(onVisibilityChange?: (visible: boolean) => void): boolean {
  const panel = getSettingsPanel();
  if (!panel) return false;
  const hidden = panel.classList.toggle("hidden");
  const visible = !hidden;
  onVisibilityChange?.(visible);
  return visible;
}
