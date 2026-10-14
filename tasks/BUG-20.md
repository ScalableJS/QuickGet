---
type: "task"
id: "BUG-20"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Monitoring give-up leaves a permanently stale active toolbar

**Severity:** high · **Area:** background

After four failed QNAP polls the alarm stopped while the last active count/icon remained visible
indefinitely. **Resolved 2026-08-29** — sustained monitoring failure now replaces the stale count
with a persistent attention state explaining that Download Station is unreachable. Opening the
popup acknowledges it and immediately re-arms reconciliation.
