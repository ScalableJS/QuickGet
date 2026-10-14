---
type: "task"
id: "BUG-26"
status: "done"
priority: "p2"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Monitoring retry inherits an exhausted error streak

**Severity:** medium · **Area:** background

After give-up, opening the popup re-arms monitoring with `errorStreak >= ERROR_LIMIT`, so the first
new failure immediately gives up again. Acceptance: explicit acknowledgement starts a fresh retry
budget without letting unrelated successful work erase an unread failure.

**Resolved 2026-08-29** — successful acknowledgement resets the monitoring error streak before
reconciliation is re-armed.
