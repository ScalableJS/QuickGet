---
type: "task"
id: "BUG-27"
status: "done"
priority: "p3"
area: "background/performance"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "low"
---

# Every monitoring poll reads settings twice

**Severity:** low · **Area:** background/performance

`pollStatus()` loads settings for validation and `getClient()` loads them again. Acceptance: one
settings snapshot must drive validation, client signature, and client creation for the whole poll;
a test must assert one load per tick.

**Resolved 2026-08-29** — validation, signature and client creation share one settings snapshot;
tests assert a single settings load per poll.
