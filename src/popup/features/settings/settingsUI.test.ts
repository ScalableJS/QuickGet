import { describe, expect, it } from "vitest";
import { getSettingsPanel, isSettingsPanelVisible } from "./settingsUI";

describe("settingsUI", () => {
  it("returns null and false when panel does not exist in DOM", () => {
    document.body.innerHTML = "";
    expect(getSettingsPanel()).toBeNull();
    expect(isSettingsPanelVisible()).toBe(false);
  });

  it("detects hidden settings panel", () => {
    document.body.innerHTML = '<div id="settings-panel" class="hidden"></div>';
    expect(getSettingsPanel()).not.toBeNull();
    expect(isSettingsPanelVisible()).toBe(false);
  });

  it("detects visible settings panel", () => {
    document.body.innerHTML = '<div id="settings-panel" class="flex"></div>';
    expect(getSettingsPanel()).not.toBeNull();
    expect(isSettingsPanelVisible()).toBe(true);
  });
});
