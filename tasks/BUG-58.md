---
type: "task"
id: "BUG-58"
status: "todo"
priority: "p2"
area: "popup/UX"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Backlog"
severity: "medium"
---

# The background task poller writes its errors into the settings screen's status pill

**Severity:** low · **Area:** popup/UX
**Files:** `src/popup/features/downloads/downloadsManager.ts`, `src/popup/components/statusPill`

There is one status pill in the popup and two writers. While the user is in Settings, the
periodic task refresh can replace whatever Settings just said with "Failed to list downloads:
TypeError: Failed to fetch" — which, right after saving a connection to a NAS that is off, is
both redundant and less useful than the message it covers.

Found while writing `settings-connection.spec.ts`: an assertion on the pill failed roughly one
run in three, always with the poller's message. The spec was rewritten to assert the connection
card instead, which is state rather than a transient announcement — so the bug is not hidden by
its own test.

**Proposed fix:** either scope the poller's failures to the downloads list where they belong, or
give the pill a notion of precedence so a direct answer to a user action outranks a background
report.


**2026-10-09 investigation:** the user identified the popup as the affected surface. A new
Chromium diagnostic aborted popup `Task/Query`, observed the poll error, restored the route,
and confirmed a successful query and visible list while the old status error remained visible.
The successful refresh path does not resolve its error; the popup provides no dismiss control.
This recovery defect expands the original competing-writers finding. Priority is now P2.

**Acceptance extension:** recovery resolves only polling-owned feedback, repeated poll failures
do not overwrite a direct Save/Test/Upload result, and an old timer cannot erase a newer operation
message. A global `clearStatus()` on every healthy poll is not an acceptable fix. Add unit and
browser regressions through [ENG-15](ENG-15.md).

See [the audit and normalization plan](../docs/system/notification-normalization-audit.md).
