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
    chrome.storage.local.get(null, (items) => {
      const missing: Partial<Settings> = {};

      const stringWithDefault = (key: keyof Settings, fallback: string): string => {
        const raw = items[key];
        if (typeof raw === "string") {
          const trimmed = raw.trim();
          if (trimmed) return trimmed;
        } else if (typeof raw === "number") {
          const asString = String(raw).trim();
          if (asString) return asString;
        }

        if (fallback) {
          (missing as Record<string, unknown>)[key] = fallback;
        }
        return fallback;
      };

      const booleanWithDefault = (key: keyof Settings, fallback: boolean): boolean => {
        const raw = items[key];
        if (typeof raw === "boolean") {
          return raw;
        }
        if (typeof raw === "string" && raw !== "") {
          const normalized = raw.toLowerCase();
          if (normalized === "true" || normalized === "1") return true;
          if (normalized === "false" || normalized === "0") return false;
        }
        (missing as Record<string, unknown>)[key] = fallback;
        return fallback;
      };

      const settings: Settings = {
        NASsecure: booleanWithDefault("NASsecure", DEFAULTS.NASsecure),
        NASaddress: stringWithDefault("NASaddress", DEFAULTS.NASaddress),
        NASport: stringWithDefault("NASport", DEFAULTS.NASport),
        NASlogin: stringWithDefault("NASlogin", DEFAULTS.NASlogin),
        NASpassword: stringWithDefault("NASpassword", DEFAULTS.NASpassword),
        NAStempdir: stringWithDefault("NAStempdir", DEFAULTS.NAStempdir),
        NASdir: stringWithDefault("NASdir", DEFAULTS.NASdir),
        enableDebugLogging: booleanWithDefault(
          "enableDebugLogging",
          DEFAULTS.enableDebugLogging
        ),
      };

      const finish = (): void => resolve(settings);

      if (Object.keys(missing).length > 0) {
        chrome.storage.local.set(missing, finish);
      } else {
        finish();
      }
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
