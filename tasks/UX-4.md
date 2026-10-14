---
type: "task"
id: "UX-4"
status: "done"
priority: "p2"
area: "ui"
board: "settings-ux"
updated: "2026-10-09"
legacy_status: "Done"
size: "M"
---

# Validation only runs on Save, and reports everything at once

**Size:** M · **Area:** ui

Nothing is checked until Save, then everything is checked together and reported in one line.
An empty Temp Folder is exactly the case this hid — see the field report in
`docs/download-interception-bugs.md`.

**Proposal:** validate a field on `blur`; on Save, move focus to the first field in error.
Required fields come from `findConfigProblem()` — the background already uses it, and a second
list would drift from the first.

**Depends on:** UX-1. **Blocked by decision in:** UX-2.
