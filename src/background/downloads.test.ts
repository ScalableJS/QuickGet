import { describe, expect, it } from "vitest";

import { getChromeSessionStorageSnapshot, seedChromeSessionStorage } from "../../tests/mocks/chrome";

import { sweepStalePending } from "./downloads.js";

describe("sweepStalePending", () => {
  it("removes expired/malformed pending records and keeps fresh ones and unrelated keys", async () => {
    const now = Date.now();
    seedChromeSessionStorage({
      pending_1: { url: "http://t/old.torrent", filename: "old.torrent", createdAt: now - 2 * 60 * 60 * 1000 },
      pending_2: { url: "http://t/fresh.torrent", filename: "fresh.torrent", createdAt: now - 1000 },
      pending_3: { url: "http://t/legacy.torrent", filename: "legacy.torrent" }, // no createdAt
      sessionNASpassword: "secret",
    });

    await sweepStalePending();

    const snapshot = getChromeSessionStorageSnapshot();
    expect(snapshot.pending_1).toBeUndefined(); // expired
    expect(snapshot.pending_3).toBeUndefined(); // malformed (no createdAt)
    expect(snapshot.pending_2).toBeDefined(); // still fresh
    expect(snapshot.sessionNASpassword).toBe("secret"); // unrelated key untouched
  });
});
