---
type: "task"
id: "BUG-23"
status: "done"
priority: "p2"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Failed attention acknowledgement discards the reason

**Severity:** medium · **Area:** background

`acknowledgeAttention()` clears `failureReason` even when Chrome rejects removal of the `!` badge.
Acceptance: failed acknowledgement preserves both badge state and reason; a later successful open
returns the same reason and clears it exactly once.

**Resolved 2026-08-29** — a rejected badge clear returns but retains the reason and failure state;
only a successful acknowledgement consumes it.
