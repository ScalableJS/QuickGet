---
type: "task"
id: "BUG-58"
status: "todo"
priority: "p3"
area: "popup/UX"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Backlog"
severity: "low"
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
