/**
 * Settings module - manages chrome.storage.local and chrome.storage.session operations
 * Consolidated storage I/O for application configuration
 */

import type { Settings, ThemeMode, TorrentInterceptMode } from "./config.js";
import { DEFAULTS, INTERCEPT_MODES, THEME_MODES } from "./config.js";
import { decryptPassword, encryptPassword, type EncryptedDataBlob } from "./credentials.js";
import { createLogger } from "./logger.js";
import { sanitizeRoutingRules } from "./routingRules.js";

const logger = createLogger("Settings", { enabled: true });

/**
 * Load settings from chrome.storage.local/session with fallback to defaults
 */
export async function loadSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (localItems) => {
      chrome.storage.session.get("sessionNASpassword", (sessionItems) => {
        const missing: Partial<Settings> = {};

        const stringWithDefault = (key: keyof Settings, fallback: string): string => {
          const raw = localItems[key];
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
          const raw = localItems[key];
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

        /**
         * Behavioural flags are resolved in memory only — deliberately NOT added to
         * `missing`. Persisting one turns it into an explicit user choice that a later
         * default change can no longer override, which is how interception silently
         * stayed off for every existing profile.
         */
        const modeWithDefault = (key: keyof Settings, fallback: TorrentInterceptMode): TorrentInterceptMode => {
          const raw = localItems[key];
          if (typeof raw === "string" && (INTERCEPT_MODES as readonly string[]).includes(raw)) {
            return raw as TorrentInterceptMode;
          }
          return fallback;
        };

        const themeWithDefault = (key: keyof Settings, fallback: ThemeMode): ThemeMode => {
          const raw = localItems[key];
          if (typeof raw === "string" && (THEME_MODES as readonly string[]).includes(raw)) {
            return raw as ThemeMode;
          }
          (missing as Record<string, unknown>)[key] = fallback;
          return fallback;
        };

        const rememberPassword = booleanWithDefault("rememberPassword", DEFAULTS.rememberPassword);
        let NASpassword = "";

        if (!rememberPassword) {
          if (typeof sessionItems.sessionNASpassword === "string") {
            NASpassword = sessionItems.sessionNASpassword;
          } else {
            // Migration case: if there's a plaintext password in local storage, move it to session and clear it from local
            const rawLocalPassword = localItems.NASpassword;
            if (typeof rawLocalPassword === "string" && rawLocalPassword.trim() !== "") {
              // Preserve the password verbatim — passwords may legitimately contain leading/trailing spaces.
              NASpassword = rawLocalPassword;
              chrome.storage.session.set({ sessionNASpassword: NASpassword });
              chrome.storage.local.set({ NASpassword: "" });
            } else {
              NASpassword = DEFAULTS.NASpassword;
            }
          }
        } else {
          if (typeof sessionItems.sessionNASpassword === "string") {
            NASpassword = sessionItems.sessionNASpassword;
          } else {
            NASpassword = ""; // locked state
          }
        }

        const settings: Settings = {
          NASsecure: booleanWithDefault("NASsecure", DEFAULTS.NASsecure),
          NASaddress: stringWithDefault("NASaddress", DEFAULTS.NASaddress),
          NASport: stringWithDefault("NASport", DEFAULTS.NASport),
          NASlogin: stringWithDefault("NASlogin", DEFAULTS.NASlogin),
          NASpassword,
          NAStempdir: stringWithDefault("NAStempdir", DEFAULTS.NAStempdir),
          NASdir: stringWithDefault("NASdir", DEFAULTS.NASdir),
          torrentInterceptMode: modeWithDefault("torrentInterceptMode", DEFAULTS.torrentInterceptMode),
          routingRules: sanitizeRoutingRules(localItems.routingRules),
          rememberPassword,
          theme: themeWithDefault("theme", DEFAULTS.theme),
        };

        const finish = (): void => resolve(settings);

        if (Object.keys(missing).length > 0) {
          chrome.storage.local.set(missing, finish);
        } else {
          finish();
        }
      });
    });
  });
}

/** Bumped whenever stored settings need a one-off fix-up on update. */
export const SETTINGS_SCHEMA_VERSION = 1;

/**
 * Releases whose `loadSettings()` persisted the resolved default of `torrentInterceptMode`,
 * writing "off" into profiles that had never chosen it.
 *
 * Only 1.0.2: `307c78a` flipped the default to "off" and bumped the manifest to 1.0.2 in the
 * same commit, so 1.0.0 and 1.0.1 shipped with "always". An "off" stored by those releases is
 * a deliberate user choice and must not be second-guessed.
 */
const INTERCEPT_DEFAULT_LEAKED_IN = ["1.0.2"];

export type SettingsMigrationResult = {
  /** Interception is off in a profile that most likely never asked for it — tell the user. */
  interceptionLeftOff: boolean;
};

/**
 * Run once per update, from `chrome.runtime.onInstalled`.
 *
 * A stored "off" cannot be told apart from a deliberate user choice, so it is never
 * rewritten — the user is notified instead and decides for themselves.
 */
export async function migrateSettings(previousVersion?: string): Promise<SettingsMigrationResult> {
  const stored = await new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.local.get(
      ["settingsSchemaVersion", "interceptNoticeShown", "torrentInterceptMode"],
      (items) => resolve(items),
    );
  });

  // `previousVersion` is only set when reason === "update", so a fresh install never matches.
  const interceptionLeftOff =
    stored.interceptNoticeShown !== true &&
    previousVersion !== undefined &&
    INTERCEPT_DEFAULT_LEAKED_IN.includes(previousVersion) &&
    stored.torrentInterceptMode === "off";

  if (stored.settingsSchemaVersion !== SETTINGS_SCHEMA_VERSION) {
    await new Promise<void>((resolve) =>
      chrome.storage.local.set({ settingsSchemaVersion: SETTINGS_SCHEMA_VERSION }, resolve),
    );
  }

  return { interceptionLeftOff };
}

/**
 * Record that the interception notice was delivered. Kept separate from the schema version so
 * a failed `notifications.create` does not silently consume the one chance to show it.
 */
export async function markInterceptNoticeShown(): Promise<void> {
  await new Promise<void>((resolve) => chrome.storage.local.set({ interceptNoticeShown: true }, resolve));
}

/**
 * Save settings to chrome.storage.local/session
 */
export async function saveSettings(
  settings: Partial<Settings>,
  options?: { masterPassword?: string },
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["rememberPassword", "encryptedNASpassword"], async (current) => {
      try {
        const rememberPassword =
          settings.rememberPassword !== undefined
            ? settings.rememberPassword
            : (current.rememberPassword ?? false);

        const localUpdate: Record<string, unknown> = { ...settings };
        delete localUpdate.NASpassword;

        const passwordToSave = settings.NASpassword;

        if (!rememberPassword) {
          // If remembering is OFF:
          localUpdate.NASpassword = "";

          const sessionUpdate: Record<string, string> = {};
          if (passwordToSave !== undefined) {
            sessionUpdate.sessionNASpassword = passwordToSave;
          }

          // Clear encrypted password and any cached master password if they exist
          await new Promise<void>((res) => chrome.storage.local.remove(["encryptedNASpassword"], res));
          await new Promise<void>((res) => chrome.storage.session.remove(["cachedMasterPassword"], res));
          await new Promise<void>((res) => chrome.storage.local.set(localUpdate, res));

          if (Object.keys(sessionUpdate).length > 0) {
            await new Promise<void>((res) => chrome.storage.session.set(sessionUpdate, res));
          }
        } else {
          // If remembering is ON:
          localUpdate.NASpassword = "";

          // Determine the plaintext NAS password to protect: prefer the freshly-entered
          // one, otherwise fall back to whatever is active in the current session.
          let plaintext = passwordToSave !== undefined && passwordToSave !== "" ? passwordToSave : undefined;
          if (plaintext === undefined) {
            const session = await new Promise<Record<string, unknown>>((res) => {
              chrome.storage.session.get("sessionNASpassword", (items) => res(items));
            });
            const existingPassword = session.sessionNASpassword;
            if (typeof existingPassword === "string" && existingPassword !== "") {
              plaintext = existingPassword;
            }
          }

          if (plaintext !== undefined) {
            if (!options?.masterPassword) {
              throw new Error("Master password is required to encrypt the NAS password");
            }
            // Re-encrypt with a fresh salt/IV on every save; this also keeps the blob in
            // sync with the (possibly newly changed) master password.
            const encryptedBlob = await encryptPassword(plaintext, options.masterPassword);
            localUpdate.encryptedNASpassword = encryptedBlob;

            await new Promise<void>((res) =>
              chrome.storage.session.set({ sessionNASpassword: plaintext }, res),
            );
          } else {
            // Nothing to protect — drop any stale blob so we never leave an
            // encryptedNASpassword that the current master password cannot decrypt.
            await new Promise<void>((res) => chrome.storage.local.remove(["encryptedNASpassword"], res));
          }

          await new Promise<void>((res) => chrome.storage.local.set(localUpdate, res));
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Check if the extension settings are currently locked
 */
export async function isLocked(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["rememberPassword", "encryptedNASpassword"], (local) => {
      if (!local.rememberPassword || !local.encryptedNASpassword) {
        resolve(false);
        return;
      }
      chrome.storage.session.get("sessionNASpassword", (session) => {
        resolve(!session.sessionNASpassword);
      });
    });
  });
}

/**
 * Attempt to unlock the extension using the master password
 */
export async function unlock(masterPassword: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["rememberPassword", "encryptedNASpassword"], async (local) => {
      if (!local.rememberPassword || !local.encryptedNASpassword) {
        resolve(true); // nothing to unlock
        return;
      }
      try {
        const decrypted = await decryptPassword(
          local.encryptedNASpassword as EncryptedDataBlob,
          masterPassword,
        );
        chrome.storage.session.set({ sessionNASpassword: decrypted }, () => {
          resolve(true);
        });
      } catch (error) {
        // A decrypt failure usually means a wrong master password, but can also be a
        // corrupt blob — log it so the difference is debuggable, then report "locked".
        logger.error("Unlock failed:", error);
        resolve(false);
      }
    });
  });
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
