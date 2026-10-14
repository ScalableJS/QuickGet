---
type: "task"
id: "BUG-28"
status: "done"
priority: "p2"
area: "background/performance"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Concurrent monitoring requests duplicate QNAP task queries

**Severity:** medium · **Area:** background/performance

Parallel interception, popup and acknowledgement events could each run an immediate `Task/Query`.
**Resolved 2026-08-29** — immediate monitoring is single-flight with dirty/rerun semantics: an
overlap produces at most one catch-up query, so a newer mutation is reconciled rather than dropped.
