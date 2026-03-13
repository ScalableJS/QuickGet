import { beforeEach, describe, expect, it } from "vitest";

import {
  buildTaskSnapshot,
  clearSelection,
  getSelectedHash,
  getSnapshot,
  onSelectionChange,
  onSnapshotChange,
  setSelectedHash,
  updateSnapshot,
} from "./downloadsState.js";

describe("downloadsState", () => {
  beforeEach(() => {
    clearSelection();
    updateSnapshot({ hashes: new Set(), names: new Set() });
  });

  it("emits selection changes only when the selected hash changes", () => {
    const seen: Array<string | null> = [];
    const unsubscribe = onSelectionChange((hash) => seen.push(hash));

    setSelectedHash("hash-1");
    setSelectedHash("hash-1");
    setSelectedHash("hash-2");
    clearSelection();
    unsubscribe();

    expect(getSelectedHash()).toBeNull();
    expect(seen).toEqual(["hash-1", "hash-2", null]);
  });

  it("normalizes snapshot hashes and names for duplicate checks", () => {
    const snapshot = buildTaskSnapshot([
      {
        hash: "ABCDEF123",
        name: "Movie.Title.[RARBG].torrent",
      },
      {
        bt_hash: "FEDCBA321",
        source_name: "Another_release-file",
      },
    ]);

    expect(snapshot.hashes).toEqual(new Set(["abcdef123", "fedcba321"]));
    expect(snapshot.names).toEqual(new Set(["movie title", "another release file"]));
  });

  it("notifies snapshot listeners on updates", () => {
    const updates: ReturnType<typeof getSnapshot>[] = [];
    const unsubscribe = onSnapshotChange((snapshot) => updates.push(snapshot));

    const snapshot = buildTaskSnapshot([{ hash: "AA11", name: "Fedora.ISO" }]);
    updateSnapshot(snapshot);
    unsubscribe();

    expect(updates).toHaveLength(1);
    expect(updates[0].hashes.has("aa11")).toBe(true);
    expect(updates[0].names.has("fedora iso")).toBe(true);
    expect(getSnapshot().hashes.has("aa11")).toBe(true);
  });
});
