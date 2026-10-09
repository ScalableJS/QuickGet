---
type: "task"
id: "BUG-15"
status: "done"
priority: "p2"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Captured torrent status is slow to become visible

**Severity:** medium · **Area:** background
**Files:** `src/background/downloads.ts`, `src/background/actions.ts`, `src/background/alarms.ts`

After Chrome captures a torrent, the toolbar/popup can keep showing the previous state for a
noticeable time. Establish a timestamped real-browser trace for `onCreated → pause → AddTorrent →
Task/Query → chrome.action repaint → popup render` and separate delays owned by QuickGet from
Download Station visibility lag and Chrome/MV3 scheduling limits.

**Required investigation:** determine whether QuickGet can publish an immediate explicit
`Sending to NAS`/working state before the NAS task becomes queryable; measure whether status
changes are skipped by the toolbar state cache, the 30-second alarm cadence, service-worker
suspension, popup polling, or QNAP eventual consistency. Document unavoidable platform limits
and add deterministic tests for every improvement that remains under our control.

**Reported 2026-08-29** — the captured torrent is handed off, but the visible status changes too
late for the user to understand that processing has started.

**Resolved 2026-08-29** — hand-off publishes the active working state (`Sending torrent to QNAP…`)
before contacting the NAS, then starts an immediate catch-up query instead of waiting for the
30-second alarm. Two zero snapshots separated by at least 30 seconds are required before returning
to idle. Unit and real-Chromium tests cover immediate visibility, rapid-zero resilience and
single-flight monitoring.
