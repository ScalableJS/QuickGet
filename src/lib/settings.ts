/**
 * Settings module - manages chrome.storage.local and chrome.storage.session operations
 * Consolidated storage I/O for application configuration
 */

import type { Settings, ThemeMode } from "./config.js";
import { DEFAULTS, THEME_MODES } from "./config.js";
import { sanitizeRoutingRules } from "./routingRules.js";

/**
 * Load settings from chrome.storage.local/session with fallback to defaults
 */
export async function loadSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (localItems) => {
      chrome.storage.session.get("sessionNASpassword", (sessionItems) => {
        // Resolve defaults from this snapshot without writing them back over a newer user choice.
        const stringWithDefault = (key: keyof Settings, fallback: string): string => {
          const raw = localItems[key];
          if (typeof raw === "string") {
            const trimmed = raw.trim();
            if (trimmed) return trimmed;
          } else if (typeof raw === "number") {
            const asString = String(raw).trim();
            if (asString) return asString;
          }

          return fallback;
        };

        const booleanWithDefault = (key: keyof Settings, fallback: boolean): boolean => {
          const raw = localItems[key];
          if (typeof raw === "boolean") {
            return raw;
          }
          if (typeof raw === "string" && raw !== "") {
            const normalized = raw.toLowerCase();
            if (normalized === "true" || normalized === "1") return true;
            if (normalized === "false" || normalized === "0") return false;
          }
          return fallback;
        };

        const themeWithDefault = (key: keyof Settings, fallback: ThemeMode): ThemeMode => {
          const raw = localItems[key];
          if (typeof raw === "string" && (THEME_MODES as readonly string[]).includes(raw)) {
            return raw as ThemeMode;
          }
          return fallback;
        };

        /**
         * The NAS password is stored, full stop, and the service worker can always read it.
         * There is no locked state: a download starts when the user clicks a link, not when
         * they open the popup, so anything requiring them to type first would silently drop it.
         *
         * The session copy is honoured first; persisted local credentials provide the
         * value after browser restart when session storage is empty.
         */
        let NASpassword = "";
        if (typeof sessionItems.sessionNASpassword === "string" && sessionItems.sessionNASpassword) {
          NASpassword = sessionItems.sessionNASpassword;
        } else if (typeof localItems.NASpassword === "string" && localItems.NASpassword) {
          NASpassword = localItems.NASpassword;
        }

        const settings: Settings = {
          NASsecure: booleanWithDefault("NASsecure", DEFAULTS.NASsecure),
          NASaddress: stringWithDefault("NASaddress", DEFAULTS.NASaddress),
          NASport: stringWithDefault("NASport", DEFAULTS.NASport),
          NASlogin: stringWithDefault("NASlogin", DEFAULTS.NASlogin),
          NASpassword,
          NAStempdir: stringWithDefault("NAStempdir", DEFAULTS.NAStempdir),
          NASdir: stringWithDefault("NASdir", DEFAULTS.NASdir),
          interceptFileLinks: booleanWithDefault("interceptFileLinks", DEFAULTS.interceptFileLinks),
          routingRules: sanitizeRoutingRules(localItems.routingRules),
          theme: themeWithDefault("theme", DEFAULTS.theme),
        };

        resolve(settings);
      });
    });
  });
}

/** Bumped whenever stored settings need a one-off fix-up on update. */
export const SETTINGS_SCHEMA_VERSION = 2;

/**
 * Run once per update, from `chrome.runtime.onInstalled`.
 */
export async function migrateSettings(): Promise<void> {
  const stored = await new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.local.get("settingsSchemaVersion", (items) => resolve(items));
  });

  if (stored.settingsSchemaVersion !== SETTINGS_SCHEMA_VERSION) {
    await chrome.storage.local.remove([
      "qg:activity",
      "interceptTorrentLinks",
      "torrentInterceptMode",
      "autoCaptureMagnets",
      "suppressLocalTorrentFile",
      "interceptNoticeShown",
    ]);
    await new Promise<void>((resolve) =>
      chrome.storage.local.set({ settingsSchemaVersion: SETTINGS_SCHEMA_VERSION }, resolve),
    );
  }
}

/**
 * Save settings to chrome.storage.local/session
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const localUpdate: Record<string, unknown> = { ...settings };
  const passwordToSave = settings.NASpassword;

  // A save that does not carry a password must never change the stored one. Partial saves are
  // routine — changing a folder, a routing rule, the theme — and overwriting the password with
  // an empty string is exactly how a working connection got wiped in the field.
  if (passwordToSave === undefined) {
    delete localUpdate.NASpassword;
  } else {
    // Always persisted. A password the worker cannot read after a browser restart is a
    // password that silently stops every intercepted download, which is not a setting anyone
    // would choose on purpose. Extension storage is not encrypted, and this build does not
    // pretend otherwise: protecting data at rest is the operating system's job.
    localUpdate.NASpassword = passwordToSave;
  }

  await chrome.storage.local.set(localUpdate);

  if (passwordToSave !== undefined) {
    await chrome.storage.session.set({ sessionNASpassword: passwordToSave });
  }

  // Nothing may be left from the encrypted scheme: a stale blob is what produced a locked
  // state that no password in this UI could open.
  await chrome.storage.local.remove(["encryptedNASpassword"]);
  await chrome.storage.session.remove(["cachedMasterPassword"]);
}

/**
 * Clear all settings and restore defaults
 */
export async function resetSettings(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      chrome.storage.session.clear(() => {
        chrome.storage.local.set(DEFAULTS, () => {
          resolve();
        });
      });
    });
  });
}
