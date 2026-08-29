# Bugs — Kanban

Single source of truth for open defects. Full analysis and root causes for the interception
bugs live in `docs/download-interception-bugs.md`.

**Columns:** `Backlog` → `In Progress` → `In Review` → `Done`.
Move a card by editing its Status cell; add a dated line under the card when the status
changes. One card per defect, ordered by severity within a column.

---

## Board

| ID | Bug | Area | Severity | Status |
|----|-----|------|----------|--------|
| BUG-17 | Context-menu actions are unclear and appear in irrelevant places | background/UX | medium | Backlog |
| BUG-15 | Captured torrent status is slow to become visible | background | medium | Backlog |
| BUG-16 | Interception error badge has no defined lifetime | background | medium | Backlog |
| BUG-14 | Context-menu sends omit working and failure toolbar states | background | medium | Done |
| BUG-13 | Toolbar repaint failure aborts the NAS hand-off | background | high | Done |
| BUG-12 | Parallel toolbar transitions lose the newer failure state | background | high | Done |
| BUG-11 | Toolbar icon updates only after a later poll or popup click | background | medium | Done |
| BUG-2 | Browser download cancelled before the NAS hand-off succeeds | background | high | Done |
| BUG-3 | Locked / empty-credential state unguarded in background | background | high | Done |
| BUG-4 | Hand-off failure swallowed by `sendAndNotify` | background | medium | Done |
| BUG-1 | Interception default flipped to `off` and persisted on read | settings | high | Done |
| BUG-9 | Service worker death between pause and cancel/resume | background | medium | Done |
| BUG-8 | No settings schema version or migration path | settings | medium | Done |
| BUG-7 | No test coverage for `handleDownloadCreated` | testing | medium | Done |
| BUG-6 | Documentation drift on interception default and modes | docs | low | Done |
| BUG-5 | `.torrent` detection gaps (fragment URLs, `filename`, `onChanged`) | background | low | Done |
| BUG-10 | Right-click send hands login-protected links to the NAS as bare URLs | background | high | Done |

---

## Cards

### BUG-17 — Context-menu actions are unclear and appear in irrelevant places

**Severity:** medium · **Area:** background/UX · **Status:** Backlog
**Files:** `src/background/menus.ts`, `src/background/menus.test.ts`

Chrome currently registers `Send with QuickGet` for both links and arbitrary selected text, and
`Send current page with QuickGet` for every page context. The labels do not explain what object
will be sent, where it will go, or the difference between the two actions. The page action also
appears away from download links and can be visible on QuickGet's own extension UI, where its
purpose is especially unclear.

**Required investigation:** enumerate the useful user journeys (torrent link, magnet, direct file
URL, selected URL and current-page URL); decide whether current-page sending is a real supported
feature or accidental surface area; test Chrome `documentUrlPatterns`/`targetUrlPatterns` limits;
exclude extension and unsupported schemes where possible; and replace the labels with explicit
object/action wording. The menu must not imply that arbitrary page content is sent when the
implementation only passes `tab.url`, and invalid selected text should not be presented as a
working action if Chrome cannot conditionally validate it.

**Reported 2026-08-29** — users cannot infer the distinction between `Send with QuickGet` and
`Send current page with QuickGet`; both appear in unexpectedly broad contexts, including the
extension itself.

---

### BUG-15 — Captured torrent status is slow to become visible

**Severity:** medium · **Area:** background · **Status:** Backlog
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

---

### BUG-16 — Interception error badge has no defined lifetime

**Severity:** medium · **Area:** background · **Status:** Backlog
**Files:** `src/background/actions.ts`, `src/background/notifier.ts`, `src/background/alarms.ts`

The red `!` after a failed torrent interception has no documented product lifetime. It is unclear
whether it should persist until explicit acknowledgement, disappear after a timeout, clear after
the next successful hand-off, or remain until the underlying failure is demonstrably resolved.

**Required investigation:** compare error-state lifecycles in Chrome/Edge downloads, QNAP,
Synology and established torrent clients; distinguish transient interception failures from
persistent NAS connectivity/configuration failures; define acknowledgement, timeout and recovery
rules that do not hide a failure before the user can notice it. Cover MV3 restarts, concurrent
success/failure ordering and stale persisted toolbar state with tests before changing behaviour.

**Reported 2026-08-29** — the user expected the interception error to remain visible only for a
bounded time, but the intended behaviour and competing conventions have not been established.

---

### BUG-14 — Context-menu sends omit working and failure toolbar states

**Severity:** medium · **Area:** background · **Status:** Done
**Files:** `src/background/menus.ts`, `src/background/menus.test.ts`

The context-menu path starts the same AddUrl/AddTorrent process but only requests a NAS poll
after success. While the request is in flight the toolbar remains idle, and on failure it
shows only a transient notification without the persistent red action state.

**Reproduced 2026-08-28** — gated AddUrl test observes zero active-icon writes before the NAS
response; rejected AddUrl leaves no `qg:toolbarState` failure marker.

**Done 2026-08-28** — both AddUrl and fetched-torrent context-menu sends now publish the active
state before network completion, clear only an older failure on success, and persist red on
failure. Both new regressions pass.

---

### BUG-13 — Toolbar repaint failure aborts the NAS hand-off

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/actions.ts`, `src/background/downloads.test.ts`

`markInterceptionStarted()` awaits `chrome.action.setIcon()` in the critical hand-off path.
If Chrome rejects that cosmetic API call, the torrent is never sent to the NAS. A toolbar
rendering failure must be observable in diagnostics but must never control the transfer.

**Reproduced 2026-08-28** — regression test forces `setIcon()` to reject; `AddTorrent` receives
zero requests and the browser download is not cancelled.

**Done 2026-08-28** — toolbar API failures are caught at the visual boundary. They no longer
abort a hand-off or turn a valid NAS snapshot into a monitoring failure; failed icon state is
not cached as applied, so a later transition retries it.

---

### BUG-12 — Parallel toolbar transitions lose the newer failure state

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/actions.ts`, `src/background/downloads.test.ts`

Toolbar writers independently perform `storage.session.get → mutate → set`. Two overlapping
operations can read the same revision and save in reverse order, allowing an older green
working transition to erase a newer red failure. Revision comparison cannot protect data that
was already lost by the write race.

**Reproduced 2026-08-28** — deterministic gated test overlaps the working repaint with a
parallel failure. Final persisted state is incorrectly empty at revision 0 instead of red `!`
at revision 1.

**Done 2026-08-28** — every toolbar state transition (event, poll, failure counter, clear and
reset) now passes through one same-worker queue while authoritative state remains in
`storage.session`. The deterministic overlap tests preserve the newer red revision.

**Verification:** 210/210 unit tests, 18/18 mock Chromium E2E, typecheck, Svelte check, lint and
production build all green.

---

### BUG-11 — Toolbar icon updates only after a later poll or popup click

**Severity:** medium · **Area:** background · **Status:** Done
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

---

### BUG-2 — Browser download cancelled before the NAS hand-off succeeds

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts:55-56`

`cancelBrowserDownload()` runs before `sendAndNotify()`, and the outcome is never checked.
Any failure after that line leaves the user with no file and no NAS task. Causes silent data
loss on: locked extension, wrong password, NAS offline, timeout, QNAP API error, or a
one-time tracker URL that cannot be fetched twice.

**Root cause:** ordering inherited from the removed `"ask"` mode, where cancelling first was
correct. `2ed381c` deleted the mode and left the `cancel` call in place.

**Fix:** make it transactional — pause → hand off → cancel on success, resume on failure.

**Blocks:** nothing. **Blocked by:** nothing. Do this first; it is the only data-losing defect.
**Done 2026-08-27** — `handOffToNas()` in `src/background/downloads.ts`: pause → send → cancel on
success, resume on failure. Covered by `downloads.test.ts`, which asserts the pause/cancel
ordering via `mock.invocationCallOrder`.

---

### BUG-3 — Locked / empty-credential state unguarded in background

**Severity:** high · **Area:** background · **Status:** Done
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

---

### BUG-4 — Hand-off failure swallowed by `sendAndNotify`

**Severity:** medium · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts:79-82`

Catches, notifies, and returns normally, so a rejected NAS operation becomes a fulfilled
promise. The caller cannot tell success from failure and cannot roll the download back.
On its own cosmetic — but it is what makes BUG-2 silent.

**Root cause:** under `"ask"` the function was called from a notification-button handler with
no caller to propagate to, so swallowing was correct. The refactor made it a step in a
sequence that needs the result.

**Fix:** separate the critical operation from the notification; let the error propagate.
Ship with BUG-2.
**Done 2026-08-27** — `sendAndNotify()` is gone. `handOffToNas()` keeps the critical operation
and the rollback in one place, and the error reaches the caller instead of being absorbed.

---

### BUG-1 — Interception default flipped to `off` and persisted on read

**Severity:** high · **Area:** settings · **Status:** Done
**Files:** `src/lib/config.ts:38`, `src/lib/settings.ts:53-59,113-114`, `src/lib/settings.test.ts:48`

`DEFAULTS.torrentInterceptMode` is `"off"` while the README promises Always. Worse,
`loadSettings()` writes missing defaults back to storage, so `"off"` becomes a persisted,
valid value — restoring the default alone will not help anyone who already ran the build.
`onInstalled → ensureMonitoring → loadSettings` burns it in without the popup being opened.

**Root cause:** `307c78a` stripped the `VITE_QNAP_*` bundled credentials before the store
release — correct in intent — but rewrote all of `DEFAULTS` and neutralised a behavioural flag
that was never a credential. The same commit changed the test to assert `"off"`.

**Fix:** restore `"always"`; stop persisting behavioural defaults on read; correct the test.

**Depends on:** BUG-8 (migration) — flipping the default without a migration story leaves
existing profiles broken.
**Done 2026-08-27** — default restored to `"always"`; `modeWithDefault` no longer adds the
resolved value to `missing`, so the behavioural flag is resolved in memory only.
`loadSettings()` still backfills the other missing keys — it is not a pure read.
`settings.test.ts` now asserts the flag is *not* persisted, instead of certifying the regression.

---

### BUG-7 — No test coverage for `handleDownloadCreated`

**Severity:** medium · **Area:** testing · **Status:** Done
**Files:** `tests/mocks/chrome.ts`, `src/background/downloads.test.ts` (absent)

The function carrying BUG-2 through BUG-5 has never had a test. A `downloads.test.ts` existed
but only covered `sweepStalePending`, a helper of the `"ask"` mode, and was correctly deleted
with the feature in `2ed381c` — nothing replaced it. `tests/mocks/chrome.ts` has no
`chrome.downloads` or `chrome.notifications` stubs, so the mock must be extended first.

**Fix:** extend the mock; add unit tests asserting call *order* (mode off; success →
pause/send/cancel; locked; empty password; NAS failure → resume; default not persisted).
Then one Playwright spec driving a real download through the mock NAS — that is the only
layer that can prove the browser download actually resumes.

**Sequencing:** write the failing tests against the current code *before* fixing BUG-2, so
the fix is proven.
**Done 2026-08-28** — `tests/mocks/chrome.ts` gained `downloads`/`notifications` stubs and
`createDownloadItem()`; `src/background/downloads.test.ts` covers 18 cases (written against the
old code first: 4 of the first 6 failed). `tests/e2e/download-interception.spec.ts` drives three
real Chrome downloads through a delaying torrent host, including the two original defects: an
unreachable NAS and a missing credential must both leave the file intact. Added to
`test:e2e:mock`, so CI gates on it.

---

### BUG-5 — `.torrent` detection gaps

**Severity:** low · **Area:** background · **Status:** Done
**Files:** `src/lib/torrentSender.ts:57-60`

- `/\.torrent(\?|$)/i` misses fragments — `foo.torrent#bar` slips through.
- `item.filename` is never consulted, though it often carries the `Content-Disposition` name.
- Only `onCreated` is observed; Chrome may reveal the real MIME type or `finalUrl` later via
  `onChanged`, so endpoints like `/download?id=1234` are never intercepted.

No data loss — misclassification simply skips interception. Harden after the above are green.

**Done 2026-08-28** — `hasTorrentExtension()` accepts `?` and `#`; `isTorrentSource()` also takes
`item.filename`; a `downloads.onChanged` listener re-evaluates a download once Chrome learns its
MIME type or final URL. Adding that listener needed the claim described in BUG-9, since two
listeners can now recognise the same download.

---

### BUG-6 — Documentation drift

**Severity:** low · **Area:** docs · **Status:** Done
**Files:** `README.md:8,34`, `docs/feature-roadmap.md:220`

README claims interception is enabled by default (BUG-1 says otherwise). The roadmap still
describes modes as `off/ask/always`, but `INTERCEPT_MODES` has been `["off", "always"]` since
`2ed381c`. If `"ask"` ever shipped, stored values are now invalid and get silently rewritten
to `"off"`, feeding BUG-1. *Unverified: `"ask"` may never have reached users.*

**Done 2026-08-27** — `README.md` now describes the pause/resume behaviour accurately;
`docs/feature-roadmap.md` no longer lists the removed `ask` mode.

---

### BUG-8 — No settings schema version or migration path

**Severity:** medium · **Area:** settings · **Status:** Done

A stored `"off"` cannot be distinguished between "the bug wrote it" and "the user chose it",
so it must not be flipped silently. Needs a `settingsSchemaVersion` key and an
`onInstalled(details.previousVersion)` hook: for profiles upgrading from an affected version,
notify once rather than rewriting the user's choice.

Prerequisite for closing BUG-1 properly.

**Done 2026-08-27** — `SETTINGS_SCHEMA_VERSION` + `migrateSettings(previousVersion)` in
`src/lib/settings.ts`, called from `onInstalled` in `src/background/index.ts`. A stored `"off"`
from **1.0.2 only** raises a one-time notification and is never rewritten — verified against the
history: 1.0.0 and 1.0.1 shipped the correct `"always"` default, so an `"off"` there is the
user's own choice. The "shown" marker is separate from the schema version and is written only
after the notification was actually created.

---

### BUG-9 — Service worker death between pause and cancel/resume

**Severity:** medium · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts`

Raised by an external review of the BUG-2 fix. MV3 terminates the service worker on its own
schedule — an unreachable NAS can outlive it — so neither the cancel nor the resume runs and
the browser download stays paused with nothing left to release it. Precisely the failure case
the fix was meant to cover.

The reviewer's remedy was to drop `pause` entirely (`send → cancel on success, otherwise leave
it alone`). Rejected: without a pause the `.torrent` usually lands on disk, which is what
interception exists to prevent.

**Done 2026-08-28** — a `qg-pending-<id>` marker in `chrome.storage.session` is written before
the hand-off and cleared in a `finally`. `recoverAbandonedHandoffs()` runs on every worker
start and resumes whatever was left behind. Session storage survives a worker restart but not
a browser restart, which is the right lifetime: a download interrupted by a browser restart is
not resumable anyway.

**Related, found while testing this:** `onCreated` and `onChanged` can both recognise the same
download, and a claim implemented as `await get()` then `set()` let both callers read
"unclaimed" and send the torrent twice — visible in E2E as the torrent host being fetched five
times instead of three. The claim is now taken synchronously from an in-memory set before the
first await, with the session marker carrying it across restarts.

---

### BUG-10 — Right-click send hands login-protected links to the NAS as bare URLs

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/menus.ts`, `src/lib/torrentSender.ts`

Reported for a login-protected tracker: right-clicking a `dl.php`-style link and sending it
with the extension produced an HTML file on the NAS instead of a torrent.

`sendDownloadToStation()` always called `client.addUrl(url)`, handing the NAS a bare link. The
NAS has no session on the tracker, so it received the login page — HTTP 200, so nothing looked
wrong — and Download Station stored that HTML as the task.

The interception path had solved this from the start: fetch the `.torrent` in the browser with
`credentials: "include"` so the user's tracker cookies apply, then upload the file itself. The
context menu simply never used it.

**Worked before the fix:** anything needing no session — magnets, public direct `.torrent`
links, ordinary files. **Failed:** every login-protected tracker and any tokenised URL.

**Done 2026-08-28** — the context menu routes torrent sources through `sendTorrentUrlToNas()`,
with routing rules still applied to the destination. Magnets and plain URLs stay on `AddUrl`,
which is correct for them. `assertLooksLikeTorrent()` now rejects a payload that is not
bencoded (`d` + digit) and not `application/x-bittorrent`, so a login page becomes a clear
error — "the tracker returned a web page … you may need to log in" — instead of a broken NAS
task. Six tests in `menus.test.ts`, five of which fail on the old code, plus an opt-in live spec
(`tests/e2e/private-tracker.real.spec.ts`) that proves an extension-origin fetch really carries
the site session — the target site is configured locally and not recorded here.

---

## Measured behaviour worth remembering

E2E (`tests/e2e/download-interception.spec.ts`) established something the design assumed
otherwise: **a small `.torrent` from a fast host reaches `complete` before the cancel can take
effect**, so Chrome keeps a local copy even on a fully successful hand-off. The pause/cancel
transaction therefore protects against *loss*, not against a stray file. The spec asserts the
contract that actually holds — the download is never left in progress — rather than a
`interrupted` state that only occurs when the transfer is slow enough. The torrent host in the
test delays its body specifically so the transaction under test can happen at all.
