# Settings UX — Kanban

Board for the settings form: validation, grouping, accessibility, and the state model behind
the connection fields. Analysis behind these cards is in `docs/settings-ux-plan.md`; the
states they change are visible in Storybook under `Features/Settings`.

**Columns:** `Discussion` → `Backlog` → `In Progress` → `In Review` → `Done`.
`Discussion` means the approach is not settled yet — decide before writing code.
Move a card by editing its Status cell and adding a dated line under the card.

---

## Board

| ID | Task | Area | Size | Status |
|----|------|------|------|--------|
| UX-1 | `Field` cannot show an error, hint, or required state | ui | S | **Done** |
| UX-2 | Form validation approach — hand-rolled vs schema library | ui | M | **Decided: no library** |
| UX-3 | Sections are headings, not field groups | ui | S | **Done** |
| UX-4 | Validation only runs on Save, and reports everything at once | ui | M | **Done** |
| UX-5 | Status messages are never announced | ui | S | **Done** |
| UX-6 | Routing rules are unnamed field soup for screen readers | ui | M | **Done** |
| UX-7 | Connection has no connected/disconnected state model | ui | L | **Done** |
| UX-8 | Master password protects settings, not downloads | settings | M | **Done** |
| UX-9 | a11y regression gate in CI | testing | S | **Done** |
| UX-10 | Notifications fire on every outcome, including success | background | M | **Done** |
| UX-11 | No activity history in the popup | ui | M | **Done** |
| UX-12 | Folders are typed before there is anything to pick them from | ui | M | Next |
| UX-13 | Settings are one long scroll with no collapsing and a stranded Save | ui | L | **In Progress** |
| UX-14 | Export/Import sits between real settings | ui | S | Next |
| UX-15 | Torrent-link handling is guessed at, not derived from tracker sources | testing | M | Backlog |

---

## Cards

### UX-1 — `Field` cannot show an error, hint, or required state

**Size:** S · **Area:** ui · **Status:** Discussion
**Files:** `src/popup/ui/Field.svelte`

`Field` takes only `id`, `label`, `value`, `size`. There is nowhere to put an error, so every
failure is reported by one global status pill and no input is ever marked. Measured: zero
`aria-invalid` and zero `aria-describedby` in the whole popup.

**Proposal:** add `error?`, `hint?`, `required?`. The component renders `role="alert"` for the
error, wires `aria-invalid` and `aria-describedby` itself, and colours the border **in addition
to** the text — colour alone cannot carry the meaning (WCAG 1.4.1).

**Open question:** none. This one is a prerequisite for UX-4 and UX-6.

---

### UX-2 — Form validation approach: hand-rolled vs schema library

**Size:** M · **Area:** ui · **Status:** Discussion

Where validation lives today, all hand-written and all tested:

| Concern | Module |
| --- | --- |
| Server address parsing | `src/lib/serverUrl.ts` |
| NAS folder paths | `src/lib/folderPath.ts` |
| Routing rules | `src/lib/routingRules.ts` |
| Required-settings check | `src/lib/configHealth.ts` |
| Imported backup JSON | `src/popup/features/settings/settingsBackup.ts` |
| Stored settings shape | `src/lib/settings.ts` |

**The question:** introduce a schema library (Zod, Valibot) or keep hand-rolled rules.

**Against, for the form itself:**

- The rules are not shape checks. "Is this a reachable NAS folder" is answered by the NAS, not
  by a schema; `serverUrl` normalises as much as it validates. A schema would sit on top of the
  existing functions, not replace them.
- It changes nothing about the actual complaint. Zod produces messages; it does not produce
  `aria-invalid`, `aria-describedby`, focus management, or grouping. UX-1 and UX-4 are needed
  either way.
- Weight matters here in a way it does not on a server. Zod is the heaviest option; Valibot is
  modular and tree-shakes to a fraction of it. Current runtime dependencies: **one**
  (`openapi-fetch`).

**For, at two specific boundaries** — where data is not ours and the current code is weakest:

- `parseImportedSettings()` — arbitrary JSON from a user-chosen file.
- `loadSettings()` — storage written by an older version, or by a different machine's sync.

Both are trust boundaries where a declarative schema is genuinely better than
`typeof x === "string"` chains, and both are the places a malformed value silently becomes a
broken configuration.

**Recommendation:** no schema library for the form. If one is wanted for the two boundaries
above, pick **Valibot** over Zod on size, and scope it to those two functions only. Decide
before UX-4 starts, since UX-4 touches the same call sites.

---

### UX-3 — Sections are headings, not field groups

**Size:** S · **Area:** ui · **Status:** Discussion
**Files:** `src/popup/features/settings/Settings.svelte`

`Connection`, `Download defaults`, `Routing rules`, `Backup` are `<h2>` plus `<div>`. Measured:
zero `<fieldset>` in the popup. A screen reader cannot jump between groups and does not
associate a heading with the fields under it.

**Proposal:** `FormSection.svelte` wrapping `<fieldset>` + `<legend>`, with the browser's
fieldset defaults reset. Visually identical.

---

### UX-4 — Validation only runs on Save, and reports everything at once

**Size:** M · **Area:** ui · **Status:** Discussion

Nothing is checked until Save, then everything is checked together and reported in one line.
An empty Temp Folder is exactly the case this hid — see the field report in
`docs/download-interception-bugs.md`.

**Proposal:** validate a field on `blur`; on Save, move focus to the first field in error.
Required fields come from `findConfigProblem()` — the background already uses it, and a second
list would drift from the first.

**Depends on:** UX-1. **Blocked by decision in:** UX-2.

---

### UX-5 — Status messages are never announced

**Size:** S · **Area:** ui · **Status:** Discussion
**Files:** `src/popup/components/statusPill/statusPill.ts`

The status pill is inserted imperatively with no `aria-live`, so "Settings saved" and every
error are silent to assistive tech.

**Proposal:** render it inside a container with `aria-live="polite"`, `assertive` for errors.
No changes at the call sites.

---

### UX-6 — Routing rules are unnamed field soup for screen readers

**Size:** M · **Area:** ui · **Status:** Discussion

Each rule is three controls plus a delete button, with no group and no name. Three rules read
as six unlabelled fields in a row. Deleting one announces nothing.

**Proposal:** each rule is a `<fieldset>` with a visually hidden `<legend>Rule 1</legend>`;
the delete button gets `aria-label="Remove rule 1"`; removal posts a message to the live region
from UX-5.

**Depends on:** UX-3, UX-5.

---

### UX-7 — Connection has no connected/disconnected state model

**Size:** L · **Area:** ui · **Status:** Done
**Decided:** 2026-08-28 · supersedes the original "Connect / Disconnect" sketch
**2026-08-28:** implemented. `src/lib/connectionHealth.ts` holds the health axis; the
Connection section shows a card with Test connection / Edit / Remove once configured, and the
form only while unconfigured or explicitly editing. Save and test are one action.

**Decision:** do not model this as Connected/Disconnected. A SID is a runtime cache detail — it
can expire in a minute while the saved configuration stays perfectly correct, so "disconnected"
would lie to the user. Split into three independent axes that were previously tangled:

```
Configuration : Not configured | Configured      ← address+login+password saved
NAS health    : Unknown | Ready | Unreachable | Auth failed
Settings UI   : Locked | Unlocked               ← UX-8
```

`SID expired ≠ disconnected`. The UI must never know whether a SID currently exists.

**Screens:**

- *Not configured* → the form, with one primary action **Save & test**: validate → log in →
  only persist on success. Credentials the NAS just rejected must never replace working ones.
- *Configured* → no inputs at all. `admin@qnap.home`, `✓ Ready`, `Last checked 2 minutes ago`,
  with **Test connection**, **Edit**, and a destructive **Remove connection**.
- *NAS unreachable* → `admin@qnap.home` / **NAS unreachable** / "Saved connection settings are
  still in use." Never a blank form.
- *Auth failed* → **Authentication failed** / "The NAS rejected the saved credentials." →
  **Review connection**.

**No `Disconnect` button.** It is ambiguous — log out the SID, delete the password, stop
intercepting, forget the NAS? — and logging out a SID is pointless because the next torrent
logs straight back in. Two distinct commands instead: **Edit connection** and **Remove
connection** (with confirmation). Temporarily stopping interception is the existing
`torrentInterceptMode` setting, not a connection action.

**Password field while editing:** show `Saved` with a **Change password** button rather than an
empty input. An empty field must never overwrite a stored password — that is exactly how the
password was lost in the field.

**Login vs Test connection:** one action, two labels by context — **Save & test** while
editing, **Test connection** on the configured card. No third `Connect`: it implies a
persistent session that does not exist.

**Health state persists as** `{ lastCheckedAt, lastSuccessAt, lastFailureAt, lastFailureKind }`.
No SID in it.

---

### UX-8 — Master password protects settings, not downloads

**Size:** M · **Area:** settings · **Status:** Done
**Decided:** 2026-08-28 (owner) · reviewed against an external consultation
**2026-08-28:** implemented. `credentials.ts` deleted, `settingsLock.ts` added, `isLocked()`
and `unlock()` removed from `settings.ts`, and the popup no longer hides the task list behind
a lock screen.

**Decision:** the master password no longer gates downloading. It gates access to the settings
screen. The NAS password is therefore always available to the service worker, and the global
`LOCKED` state disappears from the background path entirely.

**Consequence that must be stated honestly:** if the background can always read the NAS
password, that password cannot be encrypted with a key only the user knows. The master password
becomes a UI lock, not cryptography. Naming it "Master password" or "Encrypt NAS password"
would promise more than is delivered.

**Storage model:**

```
settingsLockEnabled      bool
settingsPasswordSalt     string
settingsPasswordVerifier PBKDF2(password, salt)   // password itself never stored
settingsUnlocked         → chrome.storage.session // cleared on browser restart
```

The NAS password lives in `chrome.storage.local`. Call
`chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })` — verified present
in `@types/chrome` — so content scripts cannot read it. This is defence in depth, not a
security boundary: extension code can still read it by design.

**UI wording** (must not overstate):

- Setting: **Protect settings** — "Require a password to view or change your NAS connection
  settings."
- Always alongside it: **"Background downloads will continue to work while settings are
  locked."**
- On create: "This password protects access to your connection settings. It does not encrypt
  the NAS password."
- Lock screen: **Settings are locked** / button **Unlock settings** — never "Unlock QuickGet".

**Rejected alternatives** (each considered, each rejected with a reason):

| Option | Verdict |
| --- | --- |
| Key in `chrome.storage.session` | No — cleared on restart, reproduces the exact failure we are removing |
| Non-extractable `CryptoKey` in IndexedDB | Technically works and survives restart, but extension code can still decrypt — at-rest hardening, not a user vault. Not worth IndexedDB, key lifecycle, migration and new failure paths in the worker |
| Device-bound key | `chrome.enterprise.platformKeys` is ChromeOS + policy-installed only. Not available to a Web Store extension |
| OS keychain via native messaging | Genuinely stronger, but needs a native component per OS. Disproportionate here |

**Steps:** remove the encrypted-password branch and migrate any existing
`encryptedNASpassword` into plain storage on first run → introduce the settings verifier →
delete `isLocked()` from the interception path, where a missing password is already reported by
`findConfigProblem()` as ordinary misconfiguration.

---

### UX-9 — a11y regression gate in CI

**Size:** S · **Area:** testing · **Status:** Discussion

Nothing prevents the above from regressing once fixed.

**Proposal:** add `@storybook/addon-a11y` (dev only) and run axe over the settings stories in
CI, alongside the existing gates.

**Depends on:** UX-1, UX-3, UX-5, UX-6 — pointless before there is something to protect.

---

### UX-10 — Notifications fire on every outcome, including success

**Size:** M · **Area:** background · **Status:** Done
**Decided:** 2026-08-28 · **Implemented:** 2026-08-28 in `src/background/notifier.ts`

A system toast is not a log. It is for something the user must learn *now*, while the popup is
closed. Today every outcome raises one, so the signal is buried in noise.

**Agreed matrix:**

| Event | Toast | Badge | History |
| --- | --- | --- | --- |
| Torrent sent successfully | **no** | — | yes |
| Already on NAS (duplicate) | **no** | — | yes |
| NAS unreachable, browser kept the file | once per failure episode | `!` | yes |
| Authentication failed | yes | `!` | yes |
| Not configured | yes (only on a user-initiated action) | `!` | yes |
| Settings UI locked | **no** | — | — |
| Hand-off failed, needs manual recovery | yes | `!` | yes |
| NAS recovered | **no** | clear `!` | yes |
| NAS says a task completed | no (default) | — | yes |

Success and duplicate go silent: nothing is required of the user, and plumbing should be
invisible when it works. No "Connection restored!" toast either.

**Failure episodes, not throttling by time.** Show a toast when the failure *type* changes, or
the state was healthy and broke again, or >30 min passed. Ten failures in a row produce one
toast, not ten. The state must live in `chrome.storage.session` — a module global is lost when
the worker dies:

```ts
notificationState: { lastKind, lastFingerprint, lastShownAt }
```

**Depends on:** UX-7 (the health axis is what an episode is measured against).

---

### UX-11 — No activity history in the popup

**Size:** M · **Area:** ui · **Status:** Done
**2026-08-28:** implemented in `src/lib/activityLog.ts` and `src/popup/features/activity/`.
Collapsed by default, 50 entries, host only — never the URL.

Making success and duplicate silent (UX-10) removes the only record that anything happened. The
popup needs a short activity list — not a delivery channel, but the place that explains what
occurred while it was closed.

```
02:14  ubuntu.torrent      Sent to NAS
02:02  movie.torrent       Already on NAS
01:48  linux.torrent       NAS unavailable — saved by browser
```

Last 20–50 entries. **Never store the full tracker URL** — signed download links carry auth
tokens in the query string. Filename, sanitised host, and outcome only.

**Blocks:** UX-10 should not ship far ahead of this, or successful sends become invisible.

---

## 2026-08-28 — implementation notes

UX-1, UX-3, UX-4, UX-5, UX-6 and UX-9 shipped together; they are one change from the user's
point of view and each is meaningless without the others.

- `Field` gained `error` and `hint`, wiring `aria-invalid` and `aria-describedby` itself.
- `FormSection` (`<fieldset>`/`<legend>`) replaced the section headings; visually identical.
- Fields validate on blur, and Save moves focus to the first one that is wrong.
- The status pill switches to `aria-live="assertive"` for errors, `polite` otherwise.
- Each routing rule is a named group; removing one announces itself.
- **UX-9 runs axe against the real popup, not Storybook** (`tests/e2e/a11y.spec.ts`), so what
  is checked is what ships, including the parts assembled imperatively. It is in
  `npm run test:e2e:mock`, so CI gates on it.

That gate immediately earned itself: it found that `FolderSelect` — where Temp Folder lives —
had no way to show a form-level error, so the field the user most often leaves empty was the
one field that could not be marked invalid. Fixed with a `formError` prop.

UX-2 closed with no library. The two trust boundaries named in the card
(`parseImportedSettings`, `loadSettings`) remain candidates for Valibot if they ever misbehave;
nothing in the form work needed one.

---

## Board complete — 2026-08-28

All eleven cards are closed. What the settings screen looked like when this board opened:
one status line for every error, no input ever marked, zero fieldsets, zero `aria-invalid`,
a password box permanently on screen that could overwrite a working password with an empty
string, and a master password that silently stopped downloads after every browser restart.

Remaining follow-up: **Valibot at the two trust boundaries** (`parseImportedSettings`,
`loadSettings`) — see UX-2. Folders became UX-12.

---

### UX-12 — Folders are typed before there is anything to pick them from

**Size:** M · **Area:** ui · **Status:** Next
**Raised:** 2026-08-28 (owner), following UX-7

Temp Folder and Target Folder sit in their own section regardless of whether the NAS is
reachable, so on first run they are typed blind. `FolderSelect` can list the real folders, but
only once there are working credentials — before that it has nothing to offer and the user is
guessing at a path format they have not been told.

That guess is what produced the failure this whole board started from: an empty Temp Folder,
which Download Station rejects with `{error: 1, reason: "temp"}`.

**Direction:** show the folder section only after a connection has succeeded, with the list
already loaded, so the folders are picked rather than typed.

**Open questions to settle first:**

1. First-run order. Connection must be saved and tested before folders can be shown, but the
   folders are required for a complete configuration — so "Configured" cannot mean "connection
   works" alone. Does the first run become two visible steps, or one form that grows?
2. What happens to the folder section when the NAS later goes unreachable? The saved values are
   still correct, so hiding them would repeat the mistake UX-7 fixed. Probably: keep them
   visible and editable, with the picker degraded to a plain text field.
3. ~~Is a default worth offering?~~ **Settled 2026-08-28: yes, `Download` for both folders.**
   Verified against a live QTS 5 NAS (`Misc/Dir` lists it among the shares QNAP creates at
   initialisation) and against the competing QNAP extension, which pre-fills folders rather
   than shipping them empty. The same check killed the idea of detecting the temp folder
   automatically: `temporary: true` comes back for *every* folder, so it means "usable as
   temporary", not "is the temporary one". Implemented; the default resolves in memory and is
   deliberately not written to storage.

---

### UX-13 — Settings are one long scroll with no collapsing and a stranded Save

**Size:** L · **Area:** ui · **Status:** Next
**Raised:** 2026-08-28 (owner): "полный бред с двумя видами", Save is out of sight while
credentials are being typed.

Every section is expanded at all times, so entering credentials pushes Save far below the fold
in a 360px-wide popup. UX-7 added a second mode (card vs form) on top of that, which made the
scroll worse rather than better.

**How Synology solves it** (read from `ds-client` 4.2, 281 settings strings):

```
Connection    → Credentials, Polling
Interface     → Global, Context menus, Quick menus, Tabs
Downloads     → General, History, Intercept
Notification  → Banners, Badge count, Snackbar
Advanced      → Settings Store snapshot (export/import)
```

Top-level groups, each an **accordion** (`panel__settings__accordion__title__*`), with only the
relevant one open. They have far more settings than us and still fit, because nothing irrelevant
is on screen.

**Decided 2026-08-28 (owner):** tabs, not accordions, with **one shared Save** outside the
panels. Accordions still make the user scroll past collapsed headers to reach Save; tabs keep
the panel a fixed height, so Save stays where it is regardless of which tab is open. The same
markup can degrade to a list on a wider surface purely in CSS if that is ever wanted.

The ordering principle is what the owner asked for: **the minimum needed to start comes first,
and what a user may never open comes last.**

| Tab | Contains | Why here |
| --- | --- | --- |
| Connection | The card / form from UX-7 | Nothing works until this is filled in |
| Downloads | Temp Folder, Target Folder, intercept mode | Required, but has working defaults |
| Appearance | Theme | Preference, no consequences |
| Advanced | Protect settings, Routing rules, Backup | Most users will never open it |

Two constraints that fall out of tabs and are easy to get wrong:

1. The `configProblem` warning must show on **every** tab — it says downloads are currently
   failing, so hiding it behind a tab defeats its purpose.
2. Save must switch to the tab containing the first invalid field before focusing it.
   `document.getElementById(id)?.focus()` silently does nothing in a hidden panel, which would
   reproduce the original complaint: pressing Save and seeing nothing happen.

**Depends on:** UX-7's card, which is the correct top of this hierarchy and stays as it is.

---

### UX-14 — Export/Import sits between real settings

**Size:** S · **Area:** ui · **Status:** Next

Backup is a top-level section of equal weight to Connection, so a rarely used maintenance
action occupies prime space in a list the user scrolls constantly.

**Synology puts it under Advanced**, titled "Settings Store snapshot", subtitled *"This is an
advanced setting meant for debugging purposes only"*, and warns before importing:
*"⚠️ Warning: Importing a settings snapshot will overwrite your current settings"*.

We have no such warning — import silently replaces the form.

**Direction:** move Export/Import into an Advanced group (folded by default, part of UX-13) and
add the overwrite confirmation before an import is applied.

---

### UX-15 — Torrent-link handling is guessed at, not derived from tracker sources

**Size:** M · **Area:** testing · **Status:** Backlog
**Raised:** 2026-08-28 (owner)

`isTorrentSource()` recognises a torrent by `.torrent`, `application/x-bittorrent`, or a
`/dl.php` path — the last one inferred from a single tracker. Every fix so far came from a
failure in the field rather than from knowing what trackers actually emit.

**Available reference:** TorrentPier is the open-source engine RuTracker is built on (PHP, and
3.0 is end-of-life since May 2026 — fine for reading, not for hosting). Reading its download
endpoint and link generation would replace guesswork with the actual shapes: the download route,
the `Content-Disposition` it sets, and how magnets are assembled
(`magnet:?xt=urn:btih:<hash>&dn=&tr=`).

**Explicitly out of scope: running a tracker.** No announce, no peers, no seeding. The value is
in the *link and response shapes*, which can be lifted from source into fixtures for the
existing `guardedTrackerHost` — the mock that already proved the hotlink path.

**Concrete deliverables:**

1. Fixtures covering each link form a real engine produces, including the ones we would fail on
   today (POST-only download endpoints, `Content-Disposition` with RFC 5987 encoding, redirects
   to a signed one-time URL).
2. `isTorrentSource()` driven by that table instead of by one remembered path.
3. Magnet handling checked against a correctly derived `info_hash` — SHA-1 over the exact
   bencoded `info` dictionary, not over a re-serialised object.

