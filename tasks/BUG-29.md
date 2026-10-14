---
type: "task"
id: "BUG-29"
status: "done"
priority: "p2"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Tracker-auth send failure is painted as a hard extension error

**Severity:** medium · **Area:** background
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
