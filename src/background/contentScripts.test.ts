import { describe, expect, it } from "vitest";

import { getChromeRuntimeMock, getChromeScriptingMock, getChromeTabsMock } from "../../tests/mocks/chrome.js";
import { refreshContentScripts } from "./contentScripts.js";

describe("refreshContentScripts", () => {
  it("reinjects every declared content script into already open web tabs", async () => {
    getChromeRuntimeMock().getManifest.mockReturnValue({
      content_scripts: [{ js: ["assets/magnet-loader.js"] }],
    } as unknown as chrome.runtime.Manifest);
    getChromeTabsMock().query.mockResolvedValue([{ id: 17 }, { id: 23 }] as chrome.tabs.Tab[]);

    await refreshContentScripts();

    expect(getChromeTabsMock().query).toHaveBeenCalledWith({ url: ["http://*/*", "https://*/*"] });
    expect(getChromeScriptingMock().executeScript).toHaveBeenCalledTimes(2);
    expect(getChromeScriptingMock().executeScript).toHaveBeenNthCalledWith(1, {
      target: { tabId: 17, allFrames: true },
      files: ["assets/magnet-loader.js"],
    });
    expect(getChromeScriptingMock().executeScript).toHaveBeenNthCalledWith(2, {
      target: { tabId: 23, allFrames: true },
      files: ["assets/magnet-loader.js"],
    });
  });

  it("continues when one tab rejects injection during an update", async () => {
    getChromeRuntimeMock().getManifest.mockReturnValue({
      content_scripts: [{ js: ["assets/magnet-loader.js"] }],
    } as unknown as chrome.runtime.Manifest);
    getChromeTabsMock().query.mockResolvedValue([{ id: 17 }, { id: 23 }] as chrome.tabs.Tab[]);
    getChromeScriptingMock().executeScript.mockRejectedValueOnce(new Error("Tab closed"));

    await expect(refreshContentScripts()).resolves.toBeUndefined();
    expect(getChromeScriptingMock().executeScript).toHaveBeenCalledTimes(2);
  });

  it("does nothing when the manifest has no content scripts", async () => {
    getChromeRuntimeMock().getManifest.mockReturnValue(
      ({ manifest_version: 3, name: "QuickGet", version: "0", content_scripts: [] }) as unknown as chrome.runtime.Manifest,
    );

    await refreshContentScripts();

    expect(getChromeTabsMock().query).not.toHaveBeenCalled();
    expect(getChromeScriptingMock().executeScript).not.toHaveBeenCalled();
  });
});
