import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestSettings } from "../../../../tests/fixtures/settings.js";
import { getApiClient } from "../../shared/api";
import { getTopLevelFolders, invalidateFolderCache } from "./folderCache.js";

vi.mock("../../shared/api", () => ({
  getApiClient: vi.fn(),
  invalidateClientCache: vi.fn(),
}));

describe("folderCache", () => {
  const mockListDir = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    invalidateFolderCache();
    mockListDir.mockReset();
    vi.mocked(getApiClient).mockResolvedValue({
      listDir: mockListDir,
    } as any);
  });

  it("fetches and caches top-level folders on first call", async () => {
    const folders = [
      { dir: "Download", path: "Download", temporary: true, writtable: true },
      { dir: "Multimedia", path: "Multimedia", temporary: false, writtable: true },
    ];
    mockListDir.mockResolvedValueOnce(folders);

    const settings = createTestSettings();
    const result1 = await getTopLevelFolders(settings);
    expect(result1).toEqual(folders);
    expect(mockListDir).toHaveBeenCalledTimes(1);

    // Second call should return cached without hitting API again
    const result2 = await getTopLevelFolders(settings);
    expect(result2).toEqual(folders);
    expect(mockListDir).toHaveBeenCalledTimes(1);
  });

  it("bypasses cache when force is true", async () => {
    mockListDir
      .mockResolvedValueOnce([{ dir: "Download", path: "Download", temporary: true, writtable: true }])
      .mockResolvedValueOnce([
        { dir: "Download", path: "Download", temporary: true, writtable: true },
        { dir: "NewFolder", path: "NewFolder", temporary: true, writtable: true },
      ]);

    const settings = createTestSettings();
    await getTopLevelFolders(settings);
    expect(mockListDir).toHaveBeenCalledTimes(1);

    const fresh = await getTopLevelFolders(settings, true);
    expect(fresh).toHaveLength(2);
    expect(mockListDir).toHaveBeenCalledTimes(2);
  });

  it("invalidates cache when connection settings change", async () => {
    mockListDir
      .mockResolvedValueOnce([{ dir: "Download", path: "Download", temporary: true, writtable: true }])
      .mockResolvedValueOnce([{ dir: "NAS2_Share", path: "NAS2_Share", temporary: true, writtable: true }]);

    const settings1 = createTestSettings({ NASaddress: "nas1.local" });
    const settings2 = createTestSettings({ NASaddress: "nas2.local" });

    const res1 = await getTopLevelFolders(settings1);
    expect(res1[0].dir).toBe("Download");

    const res2 = await getTopLevelFolders(settings2);
    expect(res2[0].dir).toBe("NAS2_Share");
    expect(mockListDir).toHaveBeenCalledTimes(2);
  });

  it("resets cache on invalidateFolderCache()", async () => {
    mockListDir
      .mockResolvedValueOnce([{ dir: "Download", path: "Download", temporary: true, writtable: true }])
      .mockResolvedValueOnce([{ dir: "Download", path: "Download", temporary: true, writtable: true }]);

    const settings = createTestSettings();
    await getTopLevelFolders(settings);
    expect(mockListDir).toHaveBeenCalledTimes(1);

    invalidateFolderCache();

    await getTopLevelFolders(settings);
    expect(mockListDir).toHaveBeenCalledTimes(2);
  });
});
