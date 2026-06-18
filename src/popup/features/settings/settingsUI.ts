export function getSettingsPanel(): HTMLElement | null {
  return document.getElementById("settings-panel");
}

export function isSettingsPanelVisible(): boolean {
  const panel = getSettingsPanel();
  return panel ? !panel.classList.contains("hidden") : false;
}
