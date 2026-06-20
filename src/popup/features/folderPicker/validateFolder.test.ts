import { describe, expect, it, vi } from "vitest";

import type { DirEntry } from "@api/client.js";

import { type FolderLister, normalizeFolderPath, validateFolder } from "./validateFolder.js";

function entry(path: string, writtable = true): DirEntry {
  const dir = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
  return { dir, path, temporary: true, writtable };
}

/** An error shaped like the one `createApiError` throws (carries a numeric `.code`). */
function apiError(code: number, reason = ""): Error {
  const error = new Error(`List dir failed (${code})`) as Error & { code: number; reason: string };
  error.code = code;
  error.reason = reason;
  return error;
}

describe("normalizeFolderPath", () => {
  it.each([
    ["", ""],
    ["/", ""],
    ["Download", "Download"],
    ["/Download", "Download"],
    ["Download/", "Download"],
    ["  /Download/  ", "Download"],
    ["Multimedia/Books", "Multimedia/Books"],
    ["Multimedia//Books", "Multimedia/Books"],
    ["/share/Download", "Download"],
    ["share/Multimedia/Movies", "Multimedia/Movies"],
    ["share", ""],
    ["\\Download\\Movies", "Download/Movies"],
  ])("normalizes %j -> %j", (input, expected) => {
    expect(normalizeFolderPath(input)).toBe(expected);
  });
});

describe("validateFolder", () => {
  it("treats empty / root as valid without hitting the NAS", async () => {
    const listDir = vi.fn<FolderLister>();
    expect(await validateFolder("", listDir)).toEqual({ status: "valid" });
    expect(await validateFolder("/", listDir)).toEqual({ status: "valid" });
    expect(listDir).not.toHaveBeenCalled();
  });

  it("validates a writable top-level folder by listing the share root", async () => {
    const listDir: FolderLister = async (path) => {
      expect(path).toBe("");
      return [entry("Download"), entry("Movies")];
    };
    expect(await validateFolder("Download", listDir)).toEqual({ status: "valid" });
  });

  it("validates a nested folder by listing its parent", async () => {
    const listDir: FolderLister = async (path) => {
      expect(path).toBe("Multimedia");
      return [entry("Multimedia/Books"), entry("Multimedia/Music")];
    };
    expect(await validateFolder("Multimedia/Books", listDir)).toEqual({ status: "valid" });
  });

  it("normalizes an absolute /share path before validating", async () => {
    const listDir: FolderLister = async (path) => {
      expect(path).toBe("");
      return [entry("Download")];
    };
    expect(await validateFolder("/share/Download", listDir)).toEqual({ status: "valid" });
  });

  it("flags a read-only folder as invalid", async () => {
    const listDir: FolderLister = async () => [entry("Download/ReadOnly", false)];
    expect(await validateFolder("Download/ReadOnly", listDir)).toEqual({
      status: "invalid",
      reason: "Folder is read-only",
    });
  });

  it("flags a folder absent from its parent listing as invalid", async () => {
    const listDir: FolderLister = async () => [entry("Download/Movies")];
    expect(await validateFolder("Download/Missing", listDir)).toEqual({
      status: "invalid",
      reason: "Folder not found on NAS",
    });
  });

  it("treats a missing parent (QNAP code 4096) as invalid", async () => {
    const listDir: FolderLister = async () => {
      throw apiError(4096, "path");
    };
    expect(await validateFolder("Nope/Deeper", listDir)).toEqual({
      status: "invalid",
      reason: "Folder not found on NAS",
    });
  });

  it("treats network / login failures as unverifiable (error, not invalid)", async () => {
    const listDir: FolderLister = async () => {
      throw new Error("Failed to fetch");
    };
    const result = await validateFolder("Download/Movies", listDir);
    expect(result.status).toBe("error");
    expect(result.reason).toContain("Failed to fetch");
  });
});
