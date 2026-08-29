import { describe, expect, it } from "vitest";

import { normalizeTasks, type TaskStatus } from "./tasks.js";

describe("QNAP task status contract", () => {
  // Official mapping read from DS.TASK_STATUS in Download Station 5.10.2's installed
  // opt/www/libs/ds-all.js; labels are defined by the adjacent lang/ENG.js artifact.
  it.each([
    [0, "queued"],
    [1, "paused"],
    [2, "stopped"],
    [3, "moving"],
    [4, "error"],
    [5, "finished"],
    [100, "seeding"],
    [101, "queuedChecking"],
    [102, "checking"],
    [103, "downloadingMetadata"],
    [104, "downloading"],
    [105, "allocating"],
  ] satisfies [number, TaskStatus][])("maps Download Station state %i to %s", (state, expected) => {
    const [task] = normalizeTasks("qnap", {
      data: [{ hash: `state-${state}`, source_name: `state-${state}`, state, progress: 42, size: 100 }],
    });

    expect(task?.status).toBe(expected);
  });

  it("preserves the real download completion chain", () => {
    const statuses = [104, 3, 100].map((state) =>
      normalizeTasks("qnap", { data: [{ hash: String(state), source_name: String(state), state }] })[0]?.status,
    );

    expect(statuses).toEqual(["downloading", "moving", "seeding"]);
  });
});
