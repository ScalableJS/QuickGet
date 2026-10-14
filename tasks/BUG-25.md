---
type: "task"
id: "BUG-25"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Worker death between pause and pending-marker write strands a download

**Severity:** high · **Area:** background

`handOffToNas()` pauses the Chrome download before persisting its recovery marker. MV3 may stop
the worker between those awaits, leaving no durable evidence for `recoverAbandonedHandoffs()`.
Acceptance: persist recovery intent before pause, remove it when pause does not occur, and prove
both order and cleanup with tests.

**Resolved 2026-08-29** — recovery intent is persisted before pause and removed immediately when
pause does not occur. Tests gate the pause call and assert marker ordering and cleanup.

**Removed 2026-08-30** — this recovery design made Chrome session storage a second source of
task state. QuickGet no longer persists hand-off intent or performs startup recovery; the NAS
is the only durable source of truth.
