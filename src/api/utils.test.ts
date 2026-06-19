import { describe, expect, it } from "vitest";

import { createApiError, getErrorMessage, isSuccessResponse } from "./utils.js";

describe("api/utils", () => {
  describe("createApiError", () => {
    it("flags QNAP AddTorrent error 8196 as a duplicate (reason is the torrent name)", () => {
      // Verified on a live NAS: re-adding an existing torrent returns
      // {"error":8196,"reason":"<torrent name>"} with no duplicate/exist keyword.
      const error = createApiError("AddTorrent error", { error: 8196, reason: "Sintel" }) as Error & {
        code: number;
        duplicate?: boolean;
      };
      expect(error.code).toBe(8196);
      expect(error.duplicate).toBe(true);
    });

    it("flags textual duplicate/exist reasons", () => {
      const dup = createApiError("x", { error: 24593, reason: "Duplicate task already exists" }) as Error & {
        duplicate?: boolean;
      };
      expect(dup.duplicate).toBe(true);
    });

    it("does not flag unrelated errors as duplicate", () => {
      const error = createApiError("x", { error: 1, reason: "temp" }) as Error & { duplicate?: boolean };
      expect(error.duplicate).toBeUndefined();
    });
  });

  describe("isSuccessResponse", () => {
    it("treats error:0 as success and non-zero as failure", () => {
      expect(isSuccessResponse({ error: 0 })).toBe(true);
      expect(isSuccessResponse({ error: 8196 })).toBe(false);
    });
  });

  describe("getErrorMessage", () => {
    it("returns the reason when present", () => {
      expect(getErrorMessage({ error: 1, reason: "temp" })).toBe("temp");
    });
  });
});
