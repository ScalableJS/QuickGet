---
type: "task"
id: "BUG-19"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Rapid zero snapshots can clear an active toolbar prematurely

**Severity:** high · **Area:** background

Two popup snapshots could increment `zeroStreak` within milliseconds and masquerade as two
30-second confirmations. **Resolved 2026-08-29** — idle requires two confident zeros separated by
at least 30 seconds; a new interception resets that window. Unit and real-Chromium tests cover the
rapid-zero and confirmed-stop paths.

**Reopened 2026-08-30** — after every task was deleted directly in Download Station, opening the
popup successfully rendered an empty task list but left the toolbar active for 30–60 seconds. The
popup's `qg:badgeSnapshot` was treated as an ordinary alarm result, so it entered the same
hysteresis window intended for a lone background poll.

**Resolved again 2026-08-30** — a completed popup `Task/Query` now explicitly confirms idle and
clears the toolbar immediately when it contains no active tasks. Alarm polling still requires two
zeros at least 30 seconds apart, preserving protection against a transient backend result. Unit
and real-Chromium regression tests cover active → empty-popup-snapshot → idle.
