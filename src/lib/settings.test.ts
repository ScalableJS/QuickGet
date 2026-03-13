import { describe, expect, it } from "vitest";

import { getChromeStorageSnapshot, seedChromeStorage } from "../../tests/mocks/chrome";

import { DEFAULTS } from "./config.js";
import { loadSettings, resetSettings, saveSettings } from "./settings.js";

describe("settings", () => {
  it("loads settings, normalizes values, and backfills missing defaults", async () => {
    seedChromeStorage({
      NASaddress: "files.local",
      NASport: 9090,
      NASsecure: "1",
      enableDebugLogging: "false",
    });

    const settings = await loadSettings();
    const snapshot = getChromeStorageSnapshot();

    expect(settings).toMatchObject({
      NASaddress: "files.local",
      NASport: "9090",
      NASsecure: true,
      enableDebugLogging: false,
      NASlogin: DEFAULTS.NASlogin,
      NAStempdir: DEFAULTS.NAStempdir,
      NASdir: DEFAULTS.NASdir,
    });
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    expect(snapshot.NASaddress).toBe("files.local");
    expect(snapshot.NASlogin).toBe(DEFAULTS.NASlogin);
    expect(snapshot.NAStempdir).toBe(DEFAULTS.NAStempdir);
  });

  it("saves partial settings into chrome.storage.local", async () => {
    await saveSettings({ NASdir: "/share/Downloads/New" });

    expect(chrome.storage.local.set).toHaveBeenCalledWith({ NASdir: "/share/Downloads/New" }, expect.any(Function));
    expect(getChromeStorageSnapshot().NASdir).toBe("/share/Downloads/New");
  });

  it("resets storage to defaults", async () => {
    seedChromeStorage({ NASaddress: "custom.local", NASdir: "/tmp/custom" });

    await resetSettings();

    expect(chrome.storage.local.clear).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(DEFAULTS, expect.any(Function));
    expect(getChromeStorageSnapshot()).toMatchObject(DEFAULTS);
  });
});
