---
type: "task"
id: "BUG-32"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Optimistic toolbar paint left dangling references after the badge refactor

**Severity:** high · **Area:** background
**Files:** `src/background/menus.ts`, `src/background/actions.test.ts`,
`src/background/alarms.test.ts`, `src/background/downloads.test.ts`,
`src/background/menus.test.ts`, `tests/e2e/download-interception.spec.ts`

The badge refactor that removed idle hysteresis (`zeroStreak`/`firstZeroAt`) and the failure
budget (`errorStreak`/`ERROR_LIMIT`) deleted `markInterceptionStarted()` and
`noteMonitoringFailure()` from `actions.ts`, but `menus.ts` still imported and called the
former. Every context-menu send therefore threw
`markInterceptionStarted is not a function` and showed "Failed to send with QuickGet" —
the primary "Send to QuickGet" path was broken, not merely mistyped. `tsc` reported 4 errors
and 23 unit tests failed.

**Resolved 2026-08-31** — `menus.ts` no longer paints an optimistic active state; it relies on
`ensureMonitoring()` exactly like the interception path in `downloads.ts`. Tests asserting the
removed behaviour were retargeted at what the code now guarantees rather than deleted wholesale:
a single successful zero is authoritative, a failed query flags the toolbar at once, and
write-coalescing (`["1","2","1",""]`) is still gated. The E2E restart test waited on the
title `"Sending torrent to QNAP…"` that nothing sets any more, which timed out and let the
download retry — masking BUG-31's real assertions behind 4 `AddTorrent` calls instead of 1.
It now waits on the hand-off itself and proves both the single upload and the erased
`DownloadItem`.
