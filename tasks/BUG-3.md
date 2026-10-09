---
type: "task"
id: "BUG-3"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Locked / empty-credential state unguarded in background

**Severity:** high · **Area:** background
**Files:** `src/background/downloads.ts:47`, `src/lib/settings.ts:93,209-215`

With `rememberPassword: true` and no unlock, `loadSettings()` returns `NASpassword: ""` and
the NAS login fails — after BUG-2 already cancelled the download. `isLocked()` is used only
by the popup.

`isLocked()` alone is **not** a sufficient guard: with `rememberPassword: false` after a
browser restart the password is also empty, yet `isLocked()` returns `false`. The correct
precondition is `if (!settings.NASpassword) return;`; `isLocked()` only picks the notification
wording.

**Root cause:** locking was designed as a popup-UI concern; the headless background entry
point into the same NAS client was never enumerated as a consumer of the precondition.

**Fix:** guard before touching the download, notify, leave the browser download alone.
Ship together with BUG-2 — same function, same commit.
**Done 2026-08-27** — `if (!settings.NASpassword)` guard before the download is touched;
`isLocked()` only selects the notification wording. Both the locked and the
restart-cleared-session cases are covered by tests.
