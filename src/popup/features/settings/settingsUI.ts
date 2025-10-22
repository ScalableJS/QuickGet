import type { Settings } from "@lib/config.js";

interface SettingsFormElements {
  secure: HTMLInputElement | null;
  address: HTMLInputElement | null;
  port: HTMLInputElement | null;
  login: HTMLInputElement | null;
  password: HTMLInputElement | null;
  tempDir: HTMLInputElement | null;
  destDir: HTMLInputElement | null;
  enableDebug: HTMLInputElement | null;
}

function getFormElements(): SettingsFormElements {
  return {
    secure: document.getElementById("NASsecure") as HTMLInputElement | null,
    address: document.getElementById("NASaddress") as HTMLInputElement | null,
    port: document.getElementById("NASport") as HTMLInputElement | null,
    login: document.getElementById("NASlogin") as HTMLInputElement | null,
    password: document.getElementById("NASpassword") as HTMLInputElement | null,
    tempDir: document.getElementById("NAStempdir") as HTMLInputElement | null,
    destDir: document.getElementById("NASdir") as HTMLInputElement | null,
    enableDebug: document.getElementById("enableDebug") as HTMLInputElement | null,
  };
}

export function fillSettingsForm(settings: Settings): void {
  const elements = getFormElements();
  elements.secure && (elements.secure.checked = settings.NASsecure);
  elements.address && (elements.address.value = settings.NASaddress);
  elements.port && (elements.port.value = settings.NASport);
  elements.login && (elements.login.value = settings.NASlogin);
  elements.password && (elements.password.value = settings.NASpassword);
  elements.tempDir && (elements.tempDir.value = settings.NAStempdir);
  elements.destDir && (elements.destDir.value = settings.NASdir);
  elements.enableDebug && (elements.enableDebug.checked = settings.enableDebugLogging);
}

export function readSettingsForm(): Settings {
  const elements = getFormElements();
  return {
    NASsecure: elements.secure?.checked ?? false,
    NASaddress: elements.address?.value ?? "",
    NASport: elements.port?.value ?? "",
    NASlogin: elements.login?.value ?? "",
    NASpassword: elements.password?.value ?? "",
    NAStempdir: elements.tempDir?.value ?? "",
    NASdir: elements.destDir?.value ?? "",
    enableDebugLogging: elements.enableDebug?.checked ?? false,
  };
}

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

export function setupSettingsForm(options: {
  onDebugToggle?: (enabled: boolean) => void;
} = {}): void {
  const elements = getFormElements();
  elements.enableDebug?.addEventListener("change", () => {
    options.onDebugToggle?.(elements.enableDebug?.checked ?? false);
  });
}
