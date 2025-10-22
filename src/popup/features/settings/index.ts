import { loadSettings, saveSettings } from "@lib/settings.js";
import type { Settings } from "@lib/config.js";
import { showStatus } from "../../components/statusPill/index.js";
import { invalidateClientCache } from "../../shared/api/index.js";
import { fillSettingsForm, readSettingsForm, setupSettingsForm, getSettingsPanel, showSettingsPanel, hideSettingsPanel, isSettingsPanelVisible } from "./settingsUI.js";
import { testConnection } from "./connectionTest.js";

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

async function restoreSettings(onDebugToggle?: (enabled: boolean) => void): Promise<void> {
  try {
    const settings = await loadSettings();
    fillSettingsForm(settings);
    onDebugToggle?.(settings.enableDebugLogging);
    showStatus("Settings loaded", "info", { autoHideMs: 1500 });
  } catch (error) {
    showStatus(`Failed to load settings: ${error}`, "error");
  }
}

async function saveSettingsFromForm(onDebugToggle?: (enabled: boolean) => void): Promise<void> {
  try {
    const settings = readSettingsForm();
    await saveSettings(settings);
    invalidateClientCache();
    onDebugToggle?.(settings.enableDebugLogging);
    showStatus("Settings saved successfully", "success", { autoHideMs: 1500 });
  } catch (error) {
    showStatus(`Failed to save settings: ${error}`, "error");
  }
}

async function handleTestConnection(): Promise<void> {
  try {
    const settings = readSettingsForm();
    showStatus("Testing connection...", "info");
    const isConnected = await testConnection(settings);
    if (isConnected) {
      showStatus("Connection successful!", "success", { autoHideMs: 2000 });
    } else {
      showStatus("Connection failed. Check settings and try again.", "error");
    }
  } catch (error) {
    showStatus(`Connection error: ${error}`, "error");
  }
}

function wireFormButtons(options: InitializeSettingsOptions): void {
  const saveBtn = document.getElementById("save-btn");
  const testBtn = document.getElementById("test-btn");

  saveBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    void saveSettingsFromForm(options.onDebugToggle);
  });

  testBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    void handleTestConnection();
  });
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
  setupSettingsForm({
    onDebugToggle: (enabled) => {
      options.onDebugToggle?.(enabled);
    },
  });

  wireFormButtons(options);
  await restoreSettings(options.onDebugToggle);

  return {
    restore: () => restoreSettings(options.onDebugToggle),
    save: () => saveSettingsFromForm(options.onDebugToggle),
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
