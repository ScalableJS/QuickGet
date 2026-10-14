---
type: "task"
id: "BUG-21"
status: "done"
priority: "p2"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Concurrent monitoring requests can recreate and postpone the alarm

**Severity:** medium · **Area:** background

Parallel `armMonitoring()` calls could both observe no alarm and recreate the same named alarm.
**Resolved 2026-08-29** — same-worker arming is serialized and `alarms.create()` is awaited; a
gated concurrency test proves one creation.
