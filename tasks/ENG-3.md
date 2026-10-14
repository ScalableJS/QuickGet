---
type: "task"
id: "ENG-3"
status: "done"
priority: "p2"
area: "core"
board: "engineering"
updated: "2026-10-09"
legacy_status: "Done"
size: "M"
---

# Remove unsupported Synology task normalization

**Priority:** P2 · **Size:** M · **Area:** core
**Files:** `src/lib/tasks.ts`, `src/lib/tasks.test.ts`

Production calls `normalizeTasks()` only for QNAP. Synology is an explicit product non-goal, yet
`Vendor`, `normalizeSynology`, two mapping tables and their tests maintain a second vendor path.

**Acceptance:** make task normalization QNAP-only and remove only tests of the deleted Synology
behavior. Keep the historical Synology research document unless its own status says it is
obsolete. The change must reduce production code and preserve every QNAP task-state mapping from
`agent-os/standards/api/qnap-download-station-contract.md`.

**Completed 2026-09-15** — normalization is QNAP-only; every numeric QNAP state mapping and the API
client tests remain green.
