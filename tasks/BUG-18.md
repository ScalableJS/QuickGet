---
type: "task"
id: "BUG-18"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Rejected action writes are cached as successfully painted

**Severity:** high · **Area:** background

Rejected `setBadgeText`, `setTitle`, or `setBadgeBackgroundColor` calls still updated persisted
state, so the diff guard suppressed retries. **Resolved 2026-08-29** — every action mutation is
awaited and cached only after success, with reject-once/retry tests for all three APIs.
