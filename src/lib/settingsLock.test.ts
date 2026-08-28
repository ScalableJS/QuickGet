import { describe, expect, it } from "vitest";

import {
  getChromeSessionStorageSnapshot,
  getChromeStorageSnapshot,
  seedChromeSessionStorage,
  seedChromeStorage,
} from "../../tests/mocks/chrome";

import {
  disableSettingsLock,
  enableSettingsLock,
  getSettingsLockState,
  lockSettings,
  unlockSettings,
} from "./settingsLock.js";

/**
 * The lock guards the settings screen. It must never be able to stop a download — that is the
 * failure the previous design produced, and the whole reason this module replaced it.
 */
describe("settings lock", () => {
  it("is off by default, and an absent lock reports as unlocked", async () => {
    expect(await getSettingsLockState()).toEqual({ enabled: false, unlocked: true });
  });

  it("never stores the password itself, only a salt and a verifier", async () => {
    await enableSettingsLock("correct horse battery");

    const stored = getChromeStorageSnapshot();
    expect(stored.settingsLockEnabled).toBe(true);
    expect(typeof stored.settingsLockSalt).toBe("string");
    expect(typeof stored.settingsLockVerifier).toBe("string");
    expect(JSON.stringify(stored)).not.toContain("correct horse battery");
  });

  it("accepts the right password and rejects a wrong one", async () => {
    await enableSettingsLock("correct horse battery");
    await lockSettings();

    expect(await unlockSettings("wrong")).toBe(false);
    expect((await getSettingsLockState()).unlocked).toBe(false);

    expect(await unlockSettings("correct horse battery")).toBe(true);
    expect((await getSettingsLockState()).unlocked).toBe(true);
  });

  it("leaves the person who just set the password on the unlocked side", async () => {
    await enableSettingsLock("correct horse battery");

    expect((await getSettingsLockState()).unlocked).toBe(true);
  });

  it("relocks when the browser restarts, since the flag lives in session storage", async () => {
    await enableSettingsLock("correct horse battery");

    seedChromeSessionStorage({});

    expect(await getSettingsLockState()).toEqual({ enabled: true, unlocked: false });
  });

  it("does not touch the NAS credentials", async () => {
    seedChromeStorage({ NASpassword: "nas-secret", NASlogin: "admin" });

    await enableSettingsLock("correct horse battery");
    await lockSettings();

    // Locked settings, and the password the background needs is still right there.
    expect(getChromeStorageSnapshot().NASpassword).toBe("nas-secret");

    await disableSettingsLock();
    expect(getChromeStorageSnapshot().NASpassword).toBe("nas-secret");
  });

  it("recovers instead of locking the user out when the verifier is unusable", async () => {
    seedChromeStorage({ settingsLockEnabled: true });

    // No salt and no verifier: refusing entry forever would be worse than treating it as off.
    expect(await unlockSettings("anything")).toBe(true);
    expect(getChromeStorageSnapshot().settingsLockEnabled).toBeUndefined();
  });

  it("clears everything it wrote when turned off", async () => {
    await enableSettingsLock("correct horse battery");
    await disableSettingsLock();

    const stored = getChromeStorageSnapshot();
    expect(stored.settingsLockEnabled).toBeUndefined();
    expect(stored.settingsLockSalt).toBeUndefined();
    expect(stored.settingsLockVerifier).toBeUndefined();
    expect(getChromeSessionStorageSnapshot().settingsUnlocked).toBeUndefined();
  });
});
