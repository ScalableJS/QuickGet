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
| BUG-33 | Torrent interception starts before a live NAS connection is established | background | high | Done |
| BUG-32 | Optimistic toolbar paint left dangling references after the badge refactor | background | high | Done |
| BUG-31 | Successful torrent hand-offs retain a Chrome DownloadItem after restart | background | high | Done |
| BUG-30 | Intercepted `.torrent` still reaches the disk — no filename-stage suppression | background | medium | In Review |
| BUG-29 | Tracker-auth send failure is painted as a hard extension error | background | medium | Done |
| BUG-25 | Losing the worker between pause and pending-marker write strands a browser download | background | high | Done |
| BUG-24 | Rejected duplicate listener can release another listener's in-flight ownership | background | high | Done |
| BUG-22 | Invalid settings can stop monitoring while leaving a stale active toolbar | background | high | Done |
| BUG-23 | Failed attention acknowledgement discards the unread reason | background | medium | Done |
| BUG-26 | Monitoring retry after acknowledgement inherits an exhausted error streak | background | medium | Done |
| BUG-28 | Concurrent monitoring requests duplicate QNAP task queries | background/performance | medium | Done |
| BUG-27 | Every monitoring poll reads settings twice | background/performance | low | Done |
| BUG-20 | Monitoring give-up leaves a permanently stale active toolbar | background | high | Done |
| BUG-19 | Rapid zero snapshots can clear an active toolbar prematurely | background | high | Done |
| BUG-18 | Rejected action writes are cached as successfully painted | background | high | Done |
| BUG-21 | Concurrent monitoring requests can recreate and postpone the alarm | background | medium | Done |
| BUG-17 | Context-menu actions are unclear and appear in irrelevant places | background/UX | medium | Done |
| BUG-15 | Captured torrent status is slow to become visible | background | medium | Done |
| BUG-16 | Interception error badge has no defined lifetime | background | medium | Done |
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

### BUG-33 — Torrent interception starts before a live NAS connection is established

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts`, `src/background/downloads.test.ts`,
`tests/e2e/download-interception.spec.ts`

A complete configuration was treated as sufficient permission to begin interception. The
extension could therefore hold or pause the Chrome transfer and fetch the `.torrent` before it
discovered during `AddTorrent` login that the NAS was offline. Although the transactional path
later resumed Chrome, the download had already been intercepted temporarily; strict no-file mode
could cancel it before learning that the NAS was unreachable.

**Resolved 2026-08-31** — every candidate now performs a live NAS login before QuickGet fetches
the torrent or calls any Chrome transfer mutation (`pause`, `cancel`, `resume`, or `erase`). A
failed preflight releases the filename hold immediately and leaves the original download entirely
to Chrome. The decision is never based on persisted connection health. Unit coverage exercises
both normal and no-local-file modes and proves that a failed preflight performs no tracker fetch
and no download mutation.

---

### BUG-32 — Optimistic toolbar paint left dangling references after the badge refactor

**Severity:** high · **Area:** background · **Status:** Done
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

---

### BUG-31 — Successful torrent hand-offs retain a Chrome DownloadItem after restart

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts`, `src/background/downloads.test.ts`,
`tests/e2e/download-interception.spec.ts`

After Download Station accepts an intercepted `.torrent`, the extension cancels the matching
Chrome transfer but intentionally leaves its `DownloadItem` in Chrome's history. A real Chromium
profile test closes and reopens the browser, then receives that same record again (`id: 1`,
`state: "complete"`, original `.torrent` URL). The current run does **not** make a second
`AddTorrent` request, so persistence is proven but automatic NAS replay is not yet reproduced.

The source code explicitly chose this behaviour: `cancelBrowserDownload()` says it keeps a
cancelled download in Chrome's list to offer the user Retry. The E2E result shows the overlooked
fast-download case: the source can already be `complete` before cancel, yet its history entry is
still retained across a browser restart.

**Decision taken:** do not mutate the browser download before `AddTorrent` succeeds; after
success, erase its terminal `DownloadItem`.
Chrome documents that `chrome.downloads.erase({ id })` removes history metadata, not a local file.
A failed hand-off or a transfer resumed because cancellation failed must remain untouched for
manual recovery.

**Evidence under test 2026-08-30** — the old implementation deliberately keeps the completed or
cancelled `DownloadItem` after NAS acceptance. The new unit and real-Chromium E2E regressions
assert that this entry must be absent. Before the fix, the E2E assertion reproduced the retained
entry; the evidence review then authorized the remediation described below.

**Implemented 2026-08-30** — after explicit approval, a successful hand-off erases its terminal
Chrome `DownloadItem`. Failure paths still retain or resume the browser download.
`downloads.erase()` removes Chrome history metadata only and does not delete a local file.
No history-wide migration or startup cleanup runs: QuickGet touches only the record belonging
to the current successful user action.

**Verified 2026-08-30** — unit tests prove `pause → AddTorrent success → cancel → erase` ordering
and retain history on both failure/recovery paths. A real persistent Chromium profile confirms
the successful item is absent after a full close/reopen and that no second `AddTorrent` occurs.

---

### BUG-30 — Intercepted `.torrent` still reaches the disk — no filename-stage suppression

**Severity:** medium · **Area:** background · **Status:** In Review
**Files:** `src/background/downloads.ts:230-247` (`handOffToNas`), `manifest.json` (permissions),
`src/lib/config.ts` (`torrentInterceptMode`), `tests/e2e/download-interception.spec.ts:113-122`

Interception is transactional but **starts too late in the download lifecycle**. `onCreated`
only fires once Chrome has already committed the transfer, so by the time `handOffToNas()`
pauses it, Chrome may have shown "Save as" and/or written the file. On a fast/small `.torrent`
the race is routinely lost: the hand-off succeeds *and* a copy lands in Downloads.

The project already knows this — `download-interception.spec.ts:113-122` asserts
`state === "interrupted" || state === "complete"` precisely because completion-before-cancel is
expected. The transaction guarantees **no data loss**, not **no local file**. That is the
correct guarantee for safety, but it is the wrong user-visible behaviour, and it makes an
honest promo recording impossible (a save dialog in frame contradicts the pitch).

**Root cause:** there is no `chrome.downloads.onDeterminingFilename` listener anywhere in the
codebase (verified: zero matches in `src/`). That event is the only hook that fires *before*
the file is committed, and it holds the download open until `suggest()` is called — which is
exactly the window a hand-off needs.

**What the API does and does not allow** (verified against `@types/chrome`):

- `onDeterminingFilename` (types `index.d.ts:4068`) — fires pre-commit, and the item "will not
  complete until all listeners have called `suggest`". Async is legal if the listener returns
  `true`. This is the real lever: hold here, hand off, then cancel before anything is written.
  Costs no new permission. **Chrome-only** — Firefox does not implement it, so the current
  behaviour must remain the fallback.
- `downloads.setUiOptions({enabled:false})` (`index.d.ts:4055`) — hides the download UI, needs
  the extra `"downloads.shelf"` permission (not currently requested; would need CWS
  justification) and is profile-global//cooperative across extensions. Cosmetic only: it hides
  the shelf/bubble, it does **not** prevent the write and does **not** suppress a "Save as"
  dialog. Not a fix on its own.
- Nothing in the API suppresses the "Ask where to save each file" dialog. If the user has that
  Chrome setting on, a dialog is unavoidable once a download exists. Only never letting the
  download reach that stage avoids it.

**Proposed fix:** add an `onDeterminingFilename` listener that, for a recognised torrent under
a new *full* mode, defers `suggest()`, performs the hand-off, and cancels on success — falling
back to the current pause/cancel path on failure or on non-Chrome. Keep the existing claim
guard (`inFlight` + `CLAIMED_PREFIX`) as the single owner across all three entry points
(`onCreated`, `onChanged`, `onDeterminingFilename`) — a third listener must not double-send.

**Risks to weigh before coding:** MV3 can suspend the worker while `suggest()` is outstanding
(the download would hang — needs the same recovery sweep as `PENDING_PREFIX`); only one
extension may register the listener; a slow NAS now delays *every* torrent download visibly.
Hence the setting below rather than a silent behaviour change.

**Research — the full MV3 option space** (checked against official docs + Chromium source,
2026-08-30). Nothing else in MV3 can stop a user-initiated download from reaching the disk:

| Option | Verdict |
|---|---|
| `downloads.onDeterminingFilename` | **The only workable lever.** Fires before a target path exists — the Chromium browser test asserts `item->GetTargetFilePath().empty()` at this stage while the item is still `IN_PROGRESS`. Holding `suggest()` (return `true`) defers Chrome's native "Save as", so cancelling here means no dialog and no final file. Needs only the `downloads` permission we already hold. **Chrome-only.** |
| `declarativeNetRequest` block/redirect | Kills the request before any byte — but only matches on URL/resource type at `onBeforeRequest`, so it cannot know it is a `.torrent` when the server declares that via `Content-Disposition`. Blunt URL-suffix rules would break normal browsing. |
| DNR `responseHeaders` conditions (Chrome 128+) | **Cannot help.** Official docs: once headers arrive "a block or redirect rule with a response headers condition will still run–but cannot actually block or redirect the request." |
| `webRequest` blocking / `onHeadersReceived` cancel | **Unavailable.** `webRequestBlocking` is policy-installed-extensions only in MV3 — not an option for a Web Store extension. |
| Content script `preventDefault()` on click | Leaky by design: misses middle-click, context-menu "Save link as", JS-initiated downloads, redirects, and any server-driven `Content-Disposition` on a normal navigation. Fine as an optimisation, never as the guarantee. |
| `setUiOptions` / `setShelfEnabled` | Cosmetic only — hides the shelf/bubble, does not prevent the write or the dialog. Needs the extra `downloads.shelf` permission. |
| `downloads.download({saveAs:false})` | Irrelevant: it governs downloads *we* start, not the user's click. |

**Caveat worth stating plainly:** even here, Chrome streams bytes into a temporary
`.crdownload` before the filename is settled (Mozilla bug 1245652 discusses exactly this
Chrome behaviour). So the honest claim is "no save dialog and no file left in Downloads",
**not** "nothing ever touched the disk".

**Firefox:** `onDeterminingFilename` does not exist — Bugzilla 1245652 has been open since
2016 and is still `NEW`, for architectural reasons (downloads are not created until after the
file picker). The current pause/cancel path must remain the Firefox fallback.

**Blocks:** DEMO-1 (a save dialog must not appear on camera). **Blocked by:** nothing.

**Correction found while implementing (2026-08-30).** The first design held `suggest()` across
the whole NAS round-trip. That is wrong: Chromium's filename determiner has its own **15-second
timeout**, after which it finishes the download into the default folder regardless — crbug
40359474 reports exactly that ("file gets downloaded into default download folder after 15
seconds leaving the save as dialog open"). A slow NAS would therefore have produced the stray
file the option exists to prevent. The shipped design instead cancels as soon as the download
is recognised as ours and calls `suggest()` immediately, so the hold spans a local decision
only. Also corrected: `suggest()` does **not** override the "Always ask where to save"
preference (`NeedsConfirmation()` checks `PromptForDownload()` independently) — it is the
*cancel while the stage is held* that keeps the prompt from appearing, not the suggestion.

**Implemented 2026-08-30 (unverified in CI — see below).** `src/background/downloads.ts`:
`handleDeterminingFilename()` holds a reserved id; `handleDownloadCreated()` cancels
immediately in strict mode, before `markInterceptionStarted()`, then releases the hold;
`handOffToNas()` takes `strict` and skips the pause/cancel transaction. `onCreated` now takes a
synchronous reservation before its first `await`, because the filename event can otherwise
arrive while settings are still loading. Every terminal path releases the hold, with a
`finally` as the backstop.

**Testing gap, stated plainly:** `onDeterminingFilename` **never fires under Playwright's
persistent context** — the automation harness assigns each download a target path itself, so
the filename stage is skipped (verified by probing the running worker: the listener registers,
the event never arrives). The e2e case is therefore `test.skip` with manual steps in its
docstring, and the logic is covered by unit tests instead (`downloads.test.ts` →
`suppressLocalTorrentFile`). **Strict mode has not been exercised against a real Chrome
profile yet** — that check is still outstanding and keeps this card In Review.

---

### BUG-29 — Tracker-auth send failure is painted as a hard extension error

**Severity:** medium · **Area:** background · **Status:** Done
**Files:** `src/lib/torrentSender.ts:100-104`, `src/background/downloads.ts:260-321`,
`src/background/actions.ts`, `src/background/downloads.test.ts`

A tracker 403 (`"The tracker refused the download (HTTP 403). Open the topic page and make
sure you are logged in."`, thrown at `torrentSender.ts:100-104`) is not an extension
malfunction — it is a transient, user-actionable "no access to this specific download" state.
Today `handOffToNas()`'s catch block unconditionally calls `markConfigurationProblem()`
(`downloads.ts:263`), which paints the same red `!` / `CONFIG_BADGE` (`#D93025`) used for real
extension errors (QNAP unreachable, auth token expired, not configured). The user has no way to
tell "one download needs you to log in to the tracker" from "the extension itself is broken."

**Two bugs, same root cause — error class never reaches badge selection:**
1. `classifyFailure()` (`downloads.ts:314-321`) already types failures as `"not-configured" |
   "auth" | "unreachable" | "handoff" | "recovery-needed"`, and is already able to recognize
   tracker-403 text — but its output only feeds the OS notification (`notifyFailure()`,
   line 270), never the badge decision. Every thrown error collapses into one hard-error badge
   state regardless of class.
2. `classifyFailure()`'s own substring match is stale: it checks for `"rejected the download"`,
   but the actual thrown message says `"refused the download"` — so even where the typed result
   *is* consumed, this exact case is currently misclassified as `"handoff"` instead of `"auth"`.

**No neutral state exists yet.** `actions.ts` only has `idle` (empty badge), `active` (green),
and `CONFIG_BADGE` (red `!`). A tracker-auth failure needs a third, non-alarming state — gray/
neutral, not red — that says "no access right now" without implying the extension is broken.

**Test-first 2026-08-30** — a regression test was added before any fix, per project convention
(BUG-7, BUG-11, BUG-13 all did this): `src/background/downloads.test.ts`, helper
`mockTrackerAuthFailedHandoff()` (~lines 69-75) and test `"does not raise the hard-error badge
when only the tracker refused the download (403)"` in `describe("download interception —
configuration is visible")` (~lines 772-791). It asserts `setBadgeText` is never called with
`{ text: "!" }` and `setBadgeBackgroundColor` never with `{ color: "#D93025" }` for this failure
class. Run: `npx vitest run src/background/downloads.test.ts -t "does not raise the hard-error
badge"` — fails against current code (`setBadgeText` **is** called with `{ text: "!" }`),
confirming the reported bug and not a setup/typo error.

**Required fix (not yet applied):**
- Fix the `classifyFailure()` substring so a real tracker-403 message actually classifies as
  `"auth"` instead of falling through to `"handoff"`.
- Add a neutral/gray badge state to `actions.ts` (or reuse the closest appropriate existing
  non-error state if the product decides one already fits) and route `"auth"`-classified
  send failures to it instead of `markConfigurationProblem()`.
- Keep `markConfigurationProblem()` (red `!`) reserved for failure classes that mean the
  extension/connection itself is broken (`"not-configured"`, `"unreachable"`,
  `"recovery-needed"`), not for a single download needing tracker login.
- The new test must pass without loosening its assertions; do not delete or weaken it to make
  it green.

**Reported 2026-08-30** — user observed the toolbar badge stuck on `!` after a tracker-403
send failure and flagged that this error class should not use the same icon state as a genuine
extension/NAS-connection error.

**Done 2026-08-30** — added a gray `markSendNotice()` badge (`"i"`, `#9AA0A6`) in `actions.ts`,
distinct from the red `CONFIG_BADGE`; a hard-error state already showing always outranks it.
Fixed `classifyFailure()`'s stale substring (`"rejected"` → `"refused"`) so a real tracker-403
now classifies as `"auth"`. `handOffToNas()`'s catch block now classifies once and routes
`"auth"` to `markSendNotice()`, everything else still to `markConfigurationProblem()`. The
regression test from the test-first pass now passes without being loosened. Full suite: 272/272
unit tests, typecheck and lint clean.

---

### BUG-25 — Worker death between pause and pending-marker write strands a download

**Severity:** high · **Area:** background · **Status:** Done

`handOffToNas()` pauses the Chrome download before persisting its recovery marker. MV3 may stop
the worker between those awaits, leaving no durable evidence for `recoverAbandonedHandoffs()`.
Acceptance: persist recovery intent before pause, remove it when pause does not occur, and prove
both order and cleanup with tests.

**Resolved 2026-08-29** — recovery intent is persisted before pause and removed immediately when
pause does not occur. Tests gate the pause call and assert marker ordering and cleanup.

**Removed 2026-08-30** — this recovery design made Chrome session storage a second source of
task state. QuickGet no longer persists hand-off intent or performs startup recovery; the NAS
is the only durable source of truth.

### BUG-24 — Duplicate listener releases another listener's in-flight ownership

**Severity:** high · **Area:** background · **Status:** Done

A concurrent `onCreated`/`onChanged` invocation that fails `claimDownload()` still executes the
outer `finally` and deletes the shared `inFlight` id. A third event can enter before the owner
writes its session claim. Acceptance: only the invocation that acquired ownership may release
the in-memory guard; a gated three-listener test must produce one NAS hand-off.

**Resolved 2026-08-29** — ownership is tracked per invocation; rejected listeners cannot delete
the owner's guard. As of 2026-08-30 the guard is in memory only; no durable claim exists.

### BUG-22 — Invalid settings leave a stale active toolbar

**Severity:** high · **Area:** background · **Status:** Done

If settings become invalid after an active snapshot, `pollStatus()` clears its alarm and returns
without reconciling the visible count/icon. Acceptance: a fresh unconfigured install stays quiet,
but previously live state becomes a persistent, readable attention state before monitoring stops.

**Resolved 2026-08-29** — invalid settings replace a previously live toolbar with attention before
clearing the alarm, while a never-configured installation remains silent.

### BUG-23 — Failed attention acknowledgement discards the reason

**Severity:** medium · **Area:** background · **Status:** Done

`acknowledgeAttention()` clears `failureReason` even when Chrome rejects removal of the `!` badge.
Acceptance: failed acknowledgement preserves both badge state and reason; a later successful open
returns the same reason and clears it exactly once.

**Resolved 2026-08-29** — a rejected badge clear returns but retains the reason and failure state;
only a successful acknowledgement consumes it.

### BUG-26 — Monitoring retry inherits an exhausted error streak

**Severity:** medium · **Area:** background · **Status:** Done

After give-up, opening the popup re-arms monitoring with `errorStreak >= ERROR_LIMIT`, so the first
new failure immediately gives up again. Acceptance: explicit acknowledgement starts a fresh retry
budget without letting unrelated successful work erase an unread failure.

**Resolved 2026-08-29** — successful acknowledgement resets the monitoring error streak before
reconciliation is re-armed.

### BUG-28 — Concurrent monitoring requests duplicate QNAP task queries

**Severity:** medium · **Area:** background/performance · **Status:** Done

Parallel interception, popup and acknowledgement events could each run an immediate `Task/Query`.
**Resolved 2026-08-29** — immediate monitoring is single-flight with dirty/rerun semantics: an
overlap produces at most one catch-up query, so a newer mutation is reconciled rather than dropped.

### BUG-27 — Every monitoring poll reads settings twice

**Severity:** low · **Area:** background/performance · **Status:** Done

`pollStatus()` loads settings for validation and `getClient()` loads them again. Acceptance: one
settings snapshot must drive validation, client signature, and client creation for the whole poll;
a test must assert one load per tick.

**Resolved 2026-08-29** — validation, signature and client creation share one settings snapshot;
tests assert a single settings load per poll.

### BUG-20 — Monitoring give-up leaves a permanently stale active toolbar

**Severity:** high · **Area:** background · **Status:** Done

After four failed QNAP polls the alarm stopped while the last active count/icon remained visible
indefinitely. **Resolved 2026-08-29** — sustained monitoring failure now replaces the stale count
with a persistent attention state explaining that Download Station is unreachable. Opening the
popup acknowledges it and immediately re-arms reconciliation.

### BUG-19 — Rapid zero snapshots can clear an active toolbar prematurely

**Severity:** high · **Area:** background · **Status:** Done

Two popup snapshots could increment `zeroStreak` within milliseconds and masquerade as two
30-second confirmations. **Resolved 2026-08-29** — idle requires two confident zeros separated by
at least 30 seconds; a new interception resets that window. Unit and real-Chromium tests cover the
rapid-zero and confirmed-stop paths.

**Reopened 2026-08-30** — after every task was deleted directly in Download Station, opening the
popup successfully rendered an empty task list but left the toolbar active for 30–60 seconds. The
popup's `qg:badgeSnapshot` was treated as an ordinary alarm result, so it entered the same
hysteresis window intended for a lone background poll.

**Resolved again 2026-08-30** — a completed popup `Task/Query` now explicitly confirms idle and
clears the toolbar immediately when it contains no active tasks. Alarm polling still requires two
zeros at least 30 seconds apart, preserving protection against a transient backend result. Unit
and real-Chromium regression tests cover active → empty-popup-snapshot → idle.

### BUG-18 — Rejected action writes are cached as successfully painted

**Severity:** high · **Area:** background · **Status:** Done

Rejected `setBadgeText`, `setTitle`, or `setBadgeBackgroundColor` calls still updated persisted
state, so the diff guard suppressed retries. **Resolved 2026-08-29** — every action mutation is
awaited and cached only after success, with reject-once/retry tests for all three APIs.

### BUG-21 — Concurrent monitoring requests can recreate and postpone the alarm

**Severity:** medium · **Area:** background · **Status:** Done

Parallel `armMonitoring()` calls could both observe no alarm and recreate the same named alarm.
**Resolved 2026-08-29** — same-worker arming is serialized and `alarms.create()` is awaited; a
gated concurrency test proves one creation.

### BUG-17 — Context-menu actions are unclear and appear in irrelevant places

**Severity:** medium · **Area:** background/UX · **Status:** Done
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

**Resolved 2026-08-29** — retained one link-only action named `Send link to Download Station`.
Removed the page and selected-text actions, restricted the menu to web documents, and reject
non-HTTP(S)/magnet targets before contacting the NAS.

---

### BUG-15 — Captured torrent status is slow to become visible

**Severity:** medium · **Area:** background · **Status:** Done
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

---

### BUG-16 — Interception error badge has no defined lifetime

**Severity:** medium · **Area:** background · **Status:** Done
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

**Resolved 2026-08-29** — product rule: the error has no timer. Its reason is persisted for the
browser session and the red `!` remains until the popup is opened. Opening the popup atomically
returns the reason for the top error pill and acknowledges the toolbar alarm; later successful
handoffs and background polls cannot erase an unread failure.

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

**Superseded 2026-08-30** — persistent pending/claim markers, startup recovery and the duplicate
task Resume notification were removed. Only a synchronous in-memory guard remains for
concurrent `onCreated`/`onChanged` events; it disappears when the operation or worker ends.

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
