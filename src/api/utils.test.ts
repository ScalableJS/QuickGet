import { describe, expect, it } from "vitest";

import { createApiError, explainLoopbackUrl, getErrorMessage, isSuccessResponse } from "./utils.js";

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

describe("explainLoopbackUrl", () => {
  it("explains a loopback link when the NAS is somewhere else", () => {
    const message = explainLoopbackUrl("http://127.0.0.1:3300/files/x.iso", "192.168.88.185");
    expect(message).toContain("fetches links itself");
    expect(message).toContain("127.0.0.1");
  });

  it.each(["localhost", "127.0.0.1", "127.1.2.3", "[::1]"])("recognises %s as loopback", (host) => {
    expect(explainLoopbackUrl(`http://${host}/x.iso`, "nas.local")).toBeDefined();
  });

  it("stays quiet when the NAS is on this machine — the mock NAS case", () => {
    // A loopback URL is exactly right against a NAS running here; saying otherwise would just
    // be a different wrong message.
    expect(explainLoopbackUrl("http://127.0.0.1:3300/files/x.iso", "127.0.0.1")).toBeUndefined();
    expect(explainLoopbackUrl("http://localhost:3300/files/x.iso", "localhost")).toBeUndefined();
  });

  it("stays quiet for an ordinary link, and for input it cannot parse", () => {
    expect(explainLoopbackUrl("https://releases.ubuntu.com/x.iso", "192.168.88.185")).toBeUndefined();
    expect(explainLoopbackUrl("not a url", "192.168.88.185")).toBeUndefined();
  });
});
