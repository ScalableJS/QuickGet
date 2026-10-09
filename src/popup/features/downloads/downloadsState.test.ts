import { beforeEach, describe, expect, it } from "vitest";

import { clearSelection, getSelectedHash, onSelectionChange, setSelectedHash } from "./downloadsState.js";

describe("downloadsState", () => {
  beforeEach(() => {
    clearSelection();
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
});
