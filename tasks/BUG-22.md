---
type: "task"
id: "BUG-22"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Invalid settings leave a stale active toolbar

**Severity:** high · **Area:** background

If settings become invalid after an active snapshot, `pollStatus()` clears its alarm and returns
without reconciling the visible count/icon. Acceptance: a fresh unconfigured install stays quiet,
but previously live state becomes a persistent, readable attention state before monitoring stops.

**Resolved 2026-08-29** — invalid settings replace a previously live toolbar with attention before
clearing the alarm, while a never-configured installation remains silent.
