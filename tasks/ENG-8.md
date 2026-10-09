---
type: "task"
id: "ENG-8"
status: "done"
priority: "p3"
area: "testing/tooling"
board: "engineering"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# Make the private-tracker login helper parse env files and navigation failures honestly

**Priority:** P3 · **Size:** S · **Area:** testing/tooling
**Files:** `scripts/tracker-login.mjs`, relevant script tests

`TRACKER_E2E_TOPIC="https://…"` is currently returned with its quotes, and the following
`page.goto(...).catch(() => {})` hides the resulting navigation error. The headed window can then
open blank with no explanation during an already-manual setup flow.

**Acceptance:** strip one matching pair of single or double quotes when reading the local env
file, reject an invalid or non-HTTP(S) URL before launching Chromium, and report a failed initial
navigation with the target origin and actionable guidance while keeping credentials/query values
out of logs. Cover quoted, unquoted, blank and malformed values with a small script-level test.

**Completed 2026-09-15** — env quoting and URL validation happen before Chromium starts; navigation
errors disclose only the origin, and the script-level cases run with deployment tooling tests.
