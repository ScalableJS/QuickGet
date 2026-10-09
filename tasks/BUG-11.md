---
type: "task"
id: "BUG-11"
status: "done"
priority: "p2"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Toolbar icon updates only after a later poll or popup click

**Severity:** medium · **Area:** background
**Files:** `src/background/downloads.ts`, `src/background/actions.ts`

The interception listener has already claimed and paused a torrent, but it does not publish
that real process transition to `chrome.action`. It waits until `AddTorrent` finishes and then
queries the NAS. A newly accepted task may not appear in that first query, so the icon stays
idle until an alarm tick or opening the popup sends a fresh snapshot. The result looks as if
the toolbar needs a click to repaint, although Chrome was never asked to repaint it.

**Required behaviour:** drive the toolbar from the interception lifecycle itself — green as
soon as a valid hand-off starts, red on failure, then reconcile the count from the NAS. A
failure must remain red even when another hand-off succeeds concurrently; completion order
must not let the success clear a newer failure.

**Test-first 2026-08-28** — add regression coverage for the in-flight success state and for
concurrent success/failure ordering before changing production code.

**Done 2026-08-28** — both regression tests failed on the old implementation: no `setIcon`
call occurred while `AddTorrent` was in flight, and an earlier success cleared a later red
failure. `markInterceptionStarted()` now publishes the green active icon directly from the
download event and returns the current failure revision. A success clears only an error that
predates its own start; a newer parallel failure keeps the red `!` and its tooltip even when a
successful NAS snapshot reports active tasks. The targeted tests then passed (46/46), followed
by the full suite (203 unit, 17 mock E2E).

**Reopened 2026-08-28** — real Chrome still delays the visible change. The first regression
started from an empty toolbar cache and missed a cache/UI drift: after an extension reload the
persisted state may say `active` while Chrome is displaying the manifest's idle icon, causing
the diff guard to skip the explicit repaint. Add this state to the regression suite and verify
the event-to-toolbar transition in real Chromium rather than only through the unit mock.

**Done again 2026-08-28** — the reopened regression failed with zero `setIcon` calls. An
explicit interception event now always writes the active icon and title, even when the cached
values match. Real Chromium E2E seeds the stale-cache condition and requires the action title
to change within 2 seconds, before the deliberately delayed torrent transfer completes. Full
suite: 204 unit and 17 mock E2E.

**Lifecycle verification 2026-08-28** — Chromium E2E now also proves both terminal states:
two confirmed zero snapshots clear the badge and persist `icon: idle`, while a rejected NAS
hand-off keeps the browser download and exposes a red `!` badge (`#D93025`). The completion
case was repeated three times in parallel before the full 18-test mock E2E gate passed.
