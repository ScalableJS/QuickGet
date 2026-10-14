---
type: "task"
id: "BUG-39"
status: "todo"
priority: "p3"
area: "background/perf"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Backlog"
severity: "low"
---

# Toolbar badge background poll fetches full task list instead of lightweight `Task/Status`

> **Constraint added by BUG-62 (2026-09-13):** the toolbar now has two channels — a badge number
> that counts only the download phase, and an icon lit by downloading *or* seeding. Any migration
> to `Task/Status` must preserve that. Its `downloading` field is not the same set: the badge also
> counts `moving`, `checking`, `finishing` and `allocating`, which the aggregate cannot see, so a
> naive swap would make the number blink out mid-way through QNAP's `downloading → moving →
> seeding` chain. Reverting to a single aggregate `active` is not an option.

**Severity:** low · **Area:** background/perf
**Files:** `src/background/alarms.ts`, `src/background/actions.ts`, `src/api/client.ts`

The periodic background monitoring alarm polls `/downloadstation/V4/Task/Query` with a limit of 100
tasks on every interval, fetching the entire list of tasks and all 38 fields per task just to count
active tasks for the extension badge. QNAP provides a dedicated, lightweight `/downloadstation/V4/Task/Status`
endpoint that returns summary counts directly (`total`, `downloading`, `seeding`, `paused`, `error`)
with minimal CPU and network overhead on both the browser and the NAS.

**Proposed fix:** Implement `client.getTaskStatus()` and migrate badge count monitoring to use
`Task/Status`, reserving `Task/Query` for when the popup UI is actively open.
