import { describe, expect, it } from "vitest";

import {
  getChromeSessionStorageSnapshot,
  getChromeStorageSnapshot,
  seedChromeSessionStorage,
  seedChromeStorage,
} from "../../tests/mocks/chrome";

import { DEFAULTS } from "./config.js";
import {
  isLocked,
  loadSettings,
  markInterceptNoticeShown,
  migrateSettings,
  resetSettings,
  saveSettings,
  SETTINGS_SCHEMA_VERSION,
  unlock,
} from "./settings.js";

describe("settings", () => {
  it("uses empty connection and folder defaults", () => {
    expect(DEFAULTS).toMatchObject({
      NASaddress: "",
      NASport: "",
      NASlogin: "",
      NASpassword: "",
      NAStempdir: "",
      NASdir: "",
      torrentInterceptMode: "always",
    });
  });

  it("loads settings, normalizes values, and backfills missing defaults", async () => {
    seedChromeStorage({
      NASaddress: "files.local",
      NASport: 9090,
      NASsecure: "1",
    });

    const settings = await loadSettings();
    const snapshot = getChromeStorageSnapshot();

    expect(settings).toMatchObject({
      NASaddress: "files.local",
      NASport: "9090",
      NASsecure: true,
      NASlogin: DEFAULTS.NASlogin,
      NAStempdir: DEFAULTS.NAStempdir,
      NASdir: DEFAULTS.NASdir,
    });
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    expect(snapshot.NASaddress).toBe("files.local");
    expect(snapshot.NASlogin).toBeUndefined();
    expect(snapshot.NAStempdir).toBeUndefined();
    // Behavioural flags resolve in memory but must never be written back: persisting one
    // freezes it as a user choice that no later default change can override.
    expect(settings.torrentInterceptMode).toBe("always");
    expect(snapshot.torrentInterceptMode).toBeUndefined();
  });

  describe("migrateSettings", () => {
    it("flags interception left off by the 1.0.2 default leak without rewriting it", async () => {
      seedChromeStorage({ torrentInterceptMode: "off" });

      const { interceptionLeftOff } = await migrateSettings("1.0.2");

      expect(interceptionLeftOff).toBe(true);
      // The user's stored choice is reported, never overwritten.
      expect(getChromeStorageSnapshot().torrentInterceptMode).toBe("off");
      expect(getChromeStorageSnapshot().settingsSchemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
    });

    it("stays quiet for releases that shipped the correct default", async () => {
      // 307c78a flipped the default and bumped to 1.0.2 in one commit, so 1.0.0/1.0.1 shipped
      // "always" — an "off" stored by them is the user's own choice.
      seedChromeStorage({ torrentInterceptMode: "off" });
      expect((await migrateSettings("1.0.0")).interceptionLeftOff).toBe(false);

      seedChromeStorage({ torrentInterceptMode: "off" });
      expect((await migrateSettings("1.0.1")).interceptionLeftOff).toBe(false);
    });

    it("stays quiet on a fresh install and when interception is already on", async () => {
      // previousVersion is only set when reason === "update".
      seedChromeStorage({});
      expect((await migrateSettings(undefined)).interceptionLeftOff).toBe(false);

      seedChromeStorage({ torrentInterceptMode: "always" });
      expect((await migrateSettings("1.0.2")).interceptionLeftOff).toBe(false);
    });

    it("notifies only once the notice was actually delivered, not merely attempted", async () => {
      seedChromeStorage({ torrentInterceptMode: "off" });

      // Bumping the schema version alone must not consume the single delivery: the notice
      // stays pending until markInterceptNoticeShown() confirms it went out.
      expect((await migrateSettings("1.0.2")).interceptionLeftOff).toBe(true);
      expect((await migrateSettings("1.0.2")).interceptionLeftOff).toBe(true);

      await markInterceptNoticeShown();
      expect((await migrateSettings("1.0.2")).interceptionLeftOff).toBe(false);
    });
  });

  it("saves partial settings into chrome.storage.local", async () => {
    await saveSettings({ NASdir: "/share/Downloads/New" });

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ NASdir: "/share/Downloads/New" }),
      expect.any(Function),
    );
    expect(getChromeStorageSnapshot().NASdir).toBe("/share/Downloads/New");
  });

  it("resets storage to defaults (both local and session)", async () => {
    seedChromeStorage({ NASaddress: "custom.local", NASdir: "/tmp/custom" });
    seedChromeSessionStorage({ sessionNASpassword: "my-pass" });

    await resetSettings();

    expect(chrome.storage.local.clear).toHaveBeenCalledTimes(1);
    expect(chrome.storage.session.clear).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(DEFAULTS, expect.any(Function));
    expect(getChromeStorageSnapshot()).toMatchObject(DEFAULTS);
    expect(getChromeSessionStorageSnapshot().sessionNASpassword).toBeUndefined();
  });

  describe("rememberPassword policy", () => {
    it("handles rememberPassword: false correctly (stores password in session, clears plaintext/encrypted from local)", async () => {
      seedChromeStorage({
        rememberPassword: false,
        NASpassword: "old-local-plaintext-password",
      });

      // Load settings (should trigger migration from local to session)
      const loaded = await loadSettings();
      expect(loaded.NASpassword).toBe("old-local-plaintext-password");
      expect(getChromeStorageSnapshot().NASpassword).toBe("");
      expect(getChromeSessionStorageSnapshot().sessionNASpassword).toBe("old-local-plaintext-password");

      // Save a new password
      await saveSettings({
        rememberPassword: false,
        NASpassword: "new-session-password",
      });

      expect(getChromeStorageSnapshot().NASpassword).toBe("");
      expect(getChromeStorageSnapshot().encryptedNASpassword).toBeUndefined();
      expect(getChromeSessionStorageSnapshot().sessionNASpassword).toBe("new-session-password");
    });

    it("handles rememberPassword: true correctly (encrypts with masterPassword, stores blob in local, caches decrypted in session)", async () => {
      const masterPassword = "my-master-password";
      const nasPassword = "secret-nas-password";

      await saveSettings(
        {
          rememberPassword: true,
          NASpassword: nasPassword,
        },
        { masterPassword },
      );

      // Verify plaintext password is not in local storage
      expect(getChromeStorageSnapshot().NASpassword).toBe("");
      // Verify encrypted password exists in local storage
      expect(getChromeStorageSnapshot().encryptedNASpassword).toBeDefined();
      // Verify decrypted password is cached in session storage
      expect(getChromeSessionStorageSnapshot().sessionNASpassword).toBe(nasPassword);

      // Verify loadSettings retrieves from session storage
      const loaded = await loadSettings();
      expect(loaded.NASpassword).toBe(nasPassword);
    });

    it("handles locking and unlocking lifecycle", async () => {
      const masterPassword = "my-master-password";
      const nasPassword = "secret-nas-password";

      // Save settings with rememberPassword = true
      await saveSettings(
        {
          rememberPassword: true,
          NASpassword: nasPassword,
        },
        { masterPassword },
      );

      // Verify not locked initially because it is cached in session
      expect(await isLocked()).toBe(false);

      // Simulate browser restart by clearing session storage
      seedChromeSessionStorage({});
      expect(await isLocked()).toBe(true);

      // Loading settings when locked should return empty password
      const loadedLocked = await loadSettings();
      expect(loadedLocked.NASpassword).toBe("");

      // Attempt unlock with wrong password
      const unlockWrong = await unlock("wrong-password");
      expect(unlockWrong).toBe(false);
      expect(await isLocked()).toBe(true);

      // Unlock with correct password
      const unlockCorrect = await unlock(masterPassword);
      expect(unlockCorrect).toBe(true);
      expect(await isLocked()).toBe(false);

      // Verify loaded password is correct now
      const loadedUnlocked = await loadSettings();
      expect(loadedUnlocked.NASpassword).toBe(nasPassword);
    });

    it("re-encrypts the session password when changing the master password without re-entering the NAS password", async () => {
      const nasPassword = "secret-nas-password";

      await saveSettings(
        { rememberPassword: true, NASpassword: nasPassword },
        { masterPassword: "old-master" },
      );

      // Change the master password while saving an unrelated field (NASpassword omitted).
      await saveSettings({ rememberPassword: true, NASdir: "/share/Movies" }, { masterPassword: "new-master" });

      // The stale blob must now decrypt with the NEW master password, not the old one.
      seedChromeSessionStorage({}); // simulate restart -> locked
      expect(await isLocked()).toBe(true);
      expect(await unlock("old-master")).toBe(false);
      expect(await unlock("new-master")).toBe(true);

      const loaded = await loadSettings();
      expect(loaded.NASpassword).toBe(nasPassword);
    });

    it("clears the encrypted blob and cached master password when remembering is disabled", async () => {
      await saveSettings(
        { rememberPassword: true, NASpassword: "secret-nas-password" },
        { masterPassword: "my-master" },
      );
      seedChromeSessionStorage({
        sessionNASpassword: "secret-nas-password",
        cachedMasterPassword: "my-master",
      });

      await saveSettings({ rememberPassword: false, NASpassword: "secret-nas-password" });

      expect(getChromeStorageSnapshot().encryptedNASpassword).toBeUndefined();
      expect(getChromeSessionStorageSnapshot().cachedMasterPassword).toBeUndefined();
      expect(getChromeSessionStorageSnapshot().sessionNASpassword).toBe("secret-nas-password");
      expect(await isLocked()).toBe(false);
    });
  });
});
