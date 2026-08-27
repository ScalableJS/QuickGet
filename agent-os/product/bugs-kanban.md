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
| BUG-2 | Browser download cancelled before the NAS hand-off succeeds | background | high | Done |
| BUG-3 | Locked / empty-credential state unguarded in background | background | high | Done |
| BUG-4 | Hand-off failure swallowed by `sendAndNotify` | background | medium | Done |
| BUG-1 | Interception default flipped to `off` and persisted on read | settings | high | Done |
| BUG-9 | Service worker death between pause and cancel/resume | background | medium | Done |
| BUG-8 | No settings schema version or migration path | settings | medium | Done |
| BUG-7 | No test coverage for `handleDownloadCreated` | testing | medium | Done |
| BUG-6 | Documentation drift on interception default and modes | docs | low | Done |
| BUG-5 | `.torrent` detection gaps (fragment URLs, `filename`, `onChanged`) | background | low | Done |

---

## Cards

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

## Measured behaviour worth remembering

E2E (`tests/e2e/download-interception.spec.ts`) established something the design assumed
otherwise: **a small `.torrent` from a fast host reaches `complete` before the cancel can take
effect**, so Chrome keeps a local copy even on a fully successful hand-off. The pause/cancel
transaction therefore protects against *loss*, not against a stray file. The spec asserts the
contract that actually holds — the download is never left in progress — rather than a
`interrupted` state that only occurs when the transfer is slow enough. The torrent host in the
test delays its body specifically so the transaction under test can happen at all.
