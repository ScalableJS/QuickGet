export function getSettingsPanel(): HTMLElement | null {
  return document.getElementById("settings-panel");
}

export function showSettingsPanel(): void {
  getSettingsPanel()?.classList.remove("hidden");
}

export function hideSettingsPanel(): void {
  getSettingsPanel()?.classList.add("hidden");
}

export function isSettingsPanelVisible(): boolean {
  const panel = getSettingsPanel();
  return panel ? !panel.classList.contains("hidden") : false;
}
