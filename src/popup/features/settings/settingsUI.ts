import type { Settings, TorrentInterceptMode } from "@lib/config.js";

interface SettingsFormElements {
  secure: HTMLInputElement | null;
  address: HTMLInputElement | null;
  port: HTMLInputElement | null;
  login: HTMLInputElement | null;
  password: HTMLInputElement | null;
  tempDir: HTMLInputElement | null;
  destDir: HTMLInputElement | null;
  enableDebug: HTMLInputElement | null;
  interceptMode: HTMLSelectElement | null;
  destinationFolders: HTMLTextAreaElement | null;
}

const INTERCEPT_MODES: readonly TorrentInterceptMode[] = ["off", "ask", "always"];

function normalizeMode(value: string | undefined): TorrentInterceptMode {
  return (INTERCEPT_MODES as string[]).includes(value ?? "") ? (value as TorrentInterceptMode) : "ask";
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
    interceptMode: document.getElementById("torrentInterceptMode") as HTMLSelectElement | null,
    destinationFolders: document.getElementById("destinationFolders") as HTMLTextAreaElement | null,
  };
}

export function fillSettingsForm(settings: Settings): void {
  const elements = getFormElements();
  if (elements.secure) elements.secure.checked = settings.NASsecure;
  if (elements.address) elements.address.value = settings.NASaddress;
  if (elements.port) elements.port.value = settings.NASport;
  if (elements.login) elements.login.value = settings.NASlogin;
  if (elements.password) elements.password.value = settings.NASpassword;
  if (elements.tempDir) elements.tempDir.value = settings.NAStempdir;
  if (elements.destDir) elements.destDir.value = settings.NASdir;
  if (elements.enableDebug) elements.enableDebug.checked = settings.enableDebugLogging;
  if (elements.interceptMode) elements.interceptMode.value = settings.torrentInterceptMode;
  if (elements.destinationFolders) elements.destinationFolders.value = settings.destinationFolders;
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
    torrentInterceptMode: normalizeMode(elements.interceptMode?.value),
    destinationFolders: elements.destinationFolders?.value ?? "",
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

export function setupSettingsForm(options: { onDebugToggle?: (enabled: boolean) => void } = {}): void {
  const elements = getFormElements();
  elements.enableDebug?.addEventListener("change", () => {
    options.onDebugToggle?.(elements.enableDebug?.checked ?? false);
  });
}
