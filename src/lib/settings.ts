/**
 * Settings module - manages chrome.storage.local operations
 * Consolidated storage I/O for application configuration
 */

import type { Settings } from "./config.js";
import { DEFAULTS } from "./config.js";

/**
 * Load settings from chrome.storage.local with fallback to defaults
 */
export async function loadSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULTS, (items) => {
      const settings: Settings = {
        NASsecure: Boolean(items.NASsecure),
        NASaddress: String(items.NASaddress || DEFAULTS.NASaddress),
        NASport: String(items.NASport || DEFAULTS.NASport),
        NASlogin: String(items.NASlogin || DEFAULTS.NASlogin),
        NASpassword: String(items.NASpassword || DEFAULTS.NASpassword),
        NAStempdir: String(items.NAStempdir || DEFAULTS.NAStempdir),
        NASdir: String(items.NASdir || DEFAULTS.NASdir),
        enableDebugLogging: Boolean(items.enableDebugLogging ?? DEFAULTS.enableDebugLogging),
      };
      resolve(settings);
    });
  });
}

/**
 * Save settings to chrome.storage.local
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(settings, () => {
      resolve();
    });
  });
}

/**
 * Clear all settings and restore defaults
 */
export async function resetSettings(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      chrome.storage.local.set(DEFAULTS, () => {
        resolve();
      });
    });
  });
}
