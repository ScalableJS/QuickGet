import { describe, expect, it } from "vitest";

import {
  getChromeSessionStorageSnapshot,
  getChromeStorageSnapshot,
  seedChromeSessionStorage,
  seedChromeStorage,
} from "../../tests/mocks/chrome";

import { DEFAULTS } from "./config.js";
import {
  loadSettings,
  markInterceptNoticeShown,
  migrateSettings,
  resetSettings,
  saveSettings,
  SETTINGS_SCHEMA_VERSION,
} from "./settings.js";

describe("settings", () => {
  it("ships empty credentials but a working folder default", () => {
    expect(DEFAULTS).toMatchObject({
      NASaddress: "",
      NASport: "",
      NASlogin: "",
      NASpassword: "",
      torrentInterceptMode: "always",
    });

    // Download Station requires a temporary folder, and QNAP creates a `Download` share when
    // the NAS is initialised — so the common case works without the user guessing a path.
    expect(DEFAULTS.NAStempdir).toBe("Download");
    expect(DEFAULTS.NASdir).toBe("Download");
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
    it("removes the retired activity log", async () => {
      seedChromeStorage({ "qg:activity": [{ name: "signed-url" }] });

      await migrateSettings("1.0.3");

      expect(getChromeStorageSnapshot()["qg:activity"]).toBeUndefined();
    });

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

  describe("password storage", () => {
    it("persists the password so a restarted browser can still reach the NAS", async () => {
      await saveSettings({ NASpassword: "secret-nas-password" });

      expect(getChromeStorageSnapshot().NASpassword).toBe("secret-nas-password");
      // No encrypted blob is written any more: there is nothing to unlock, by design.
      expect(getChromeStorageSnapshot().encryptedNASpassword).toBeUndefined();

      seedChromeSessionStorage({});
      expect((await loadSettings()).NASpassword).toBe("secret-nas-password");
    });

    it("clears a blob left by the previous encrypted scheme", async () => {
      seedChromeStorage({
        encryptedNASpassword: { iv: "x", salt: "y", data: "z" },
      });

      await saveSettings({ NASpassword: "new-password" });

      // A leftover blob is what produced a locked state no password in the UI could open.
      expect(getChromeStorageSnapshot().encryptedNASpassword).toBeUndefined();
      expect(getChromeStorageSnapshot().NASpassword).toBe("new-password");
    });
  });
});

/**
 * The service worker must be able to reach the NAS the moment a link is clicked — the user is
 * not there to type anything. A stored password with no locked state is what makes that true;
 * protecting it at rest is the operating system's job, not the extension's.
 */
describe("password availability to the background", () => {
  it("survives a browser restart when remembering is on", async () => {
    await saveSettings({ NASpassword: "nas-secret" });

    seedChromeSessionStorage({});
    expect((await loadSettings()).NASpassword).toBe("nas-secret");
  });

  it("is always persisted, because a worker that cannot log in drops every download", async () => {
    await saveSettings({ NASpassword: "nas-secret" });

    // A browser restart empties session storage; the background must still be able to log in.
    seedChromeSessionStorage({});
    expect((await loadSettings()).NASpassword).toBe("nas-secret");
  });

  it("does not wipe the stored password when saving something unrelated", async () => {
    await saveSettings({ NASpassword: "nas-secret" });

    // Changing a folder, a routing rule or the theme must leave the connection alone. Writing
    // an empty password on every partial save is how a working setup got wiped in the field.
    await saveSettings({ NASdir: "Multimedia/Films" });

    expect(getChromeStorageSnapshot().NASpassword).toBe("nas-secret");
    seedChromeSessionStorage({});
    expect((await loadSettings()).NASpassword).toBe("nas-secret");
  });

  it("prefers an unsaved session edit over the stored value", async () => {
    await saveSettings({ NASpassword: "stored" });
    seedChromeSessionStorage({ sessionNASpassword: "just-typed" });

    expect((await loadSettings()).NASpassword).toBe("just-typed");
  });
});

/**
 * The folder default exists so the common case works without the user guessing a path that
 * Download Station only reports as `{error: 1, reason: "temp"}`. It must not, however, behave
 * like a decision the user made.
 */
describe("folder defaults", () => {
  it("fills an unset folder in memory without writing it back", async () => {
    seedChromeStorage({ NASaddress: "nas.local" });

    const settings = await loadSettings();

    expect(settings.NAStempdir).toBe("Download");
    // Persisting it would freeze today's default as an explicit choice no later change could
    // override — the trap the interception mode fell into.
    expect(getChromeStorageSnapshot().NAStempdir).toBeUndefined();
  });

  it("never overrides a folder the user chose", async () => {
    seedChromeStorage({ NAStempdir: "Multimedia/Incoming", NASdir: "Multimedia/Movies" });

    const settings = await loadSettings();

    expect(settings.NAStempdir).toBe("Multimedia/Incoming");
    expect(settings.NASdir).toBe("Multimedia/Movies");
  });
});
