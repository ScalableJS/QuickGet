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
| UX-12 | Folders are typed before there is anything to pick them from | ui | M | **Done** |
| UX-13 | Settings are one long scroll with no collapsing and a stranded Save | ui | L | **Done** |
| UX-14 | Export/Import sits between real settings | ui | S | **Done** |
| UX-15 | Torrent-link handling is guessed at, not derived from tracker sources | testing | M | **Done** |
| UX-16 | Settings held things that did not justify being there | ui | M | **Done** |
| UX-17 | No control over how aggressively a `.torrent` is intercepted | settings | M | **Done** |
| UX-18 | The rule editor teaches patterns that cannot match | ui | M | **Done** |
| UX-19 | Rules are write-only — nothing tells you whether they work | ui | M | Deferred |
| UX-20 | Which rule sent a task, and where, is invisible | ui | S | Rejected |
| UX-21 | A rule cannot be muted or duplicated | ui | S | Rejected |
| UX-22 | Rule-editor affordances worth borrowing from Send To QNAP++ | ui | S | Rejected |
| UX-23 | Shift-click sends one link, whatever the automatic settings say | settings | M | In Review |

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

**Size:** M · **Area:** ui · **Status:** Done

Each rule is three controls plus a delete button, with no group and no name. Three rules read
as six unlabelled fields in a row. Deleting one announces nothing.

**Proposal:** each rule is a `<fieldset>` with a visually hidden `<legend>Rule 1</legend>`;
the delete button gets `aria-label="Remove rule 1"`; removal posts a message to the live region
from UX-5.

**Depends on:** UX-3, UX-5.

**2026-09-09 — card body brought in line with the board, and partly re-opened.** The body still
read `Discussion` while the board had said `Done` since the fieldset/legend work landed; the
proposal above did ship. What did *not* survive the BUG-43 card redesign is everything around
it: condition errors are no longer associated with their fields (BUG-48), reordering is silent
and loses focus (BUG-49), and adding a rule announces nothing (BUG-53). The gate that should
have caught this never scanned the panel (BUG-51). Treat this card as "named groups, done" and
the rest as those bugs.

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

**Size:** S · **Area:** testing · **Status:** Done

Nothing prevents the above from regressing once fixed.

**Proposal:** add `@storybook/addon-a11y` (dev only) and run axe over the settings stories in
CI, alongside the existing gates.

**Depends on:** UX-1, UX-3, UX-5, UX-6 — pointless before there is something to protect.

**2026-09-09 — shipped, and narrower than it looks.** `@storybook/addon-a11y` with
`a11y: { test: "error" }` plus `tests/e2e/a11y.spec.ts` (axe over the real popup) are both in
place. But the E2E pass only scans the tab that happens to be open, and `Tabs` hides the others
with the `hidden` attribute, which axe skips. The routing rules have therefore never been
scanned by this gate. Fixed under BUG-51; the lesson worth keeping is that seeding state into
storage is not the same as rendering it where axe can see it.

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
**2026-08-28:** implemented, then removed after the full notification audit. The task list is
the source of truth; a second persisted event list duplicated it, could go stale while the popup
was open, and introduced a read-modify-write race. Failures remain visible through the deduplicated
notification, toolbar fault badge, and connection health — each with a distinct responsibility.

The original proposal assumed silent success needed a second record in the popup. In practice,
successful tasks already appear in Download Station's task list, while failures have actionable
channels. Maintaining another history answered no unique user question.

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

**Size:** M · **Area:** ui · **Status:** Done
**Raised:** 2026-08-28 (owner), following UX-7

Temp Folder and Target Folder sit in their own section regardless of whether the NAS is
reachable, so on first run they are typed blind. `FolderSelect` can list the real folders, but
only once there are working credentials — before that it has nothing to offer and the user is
guessing at a path format they have not been told.

That guess is what produced the failure this whole board started from: an empty Temp Folder,
which Download Station rejects with `{error: 1, reason: "temp"}`.

**Direction (superseded):** show the folder section only after a connection has succeeded.

**2026-08-28 — done, but not as originally sketched.** Gating the folders behind a successful
connection would have invented a two-step flow nobody else has. What the competitors do:

- **QNAP Download Station Manager** stores one object —
  `NasConnectionSettings: { url, username, password, folders: [...] }` — validated by a single
  schema in which every field, folders included, is `required`. Connection and folders are one
  form. The whole extension has two tabs: Downloads and Settings.
- **Synology** does not have this problem: `destination` is optional there (the NAS applies its
  own default) and is chosen per task, not in settings.

So the folders moved **onto the Connection tab**, directly under the credentials: everything a
first run needs is on one screen, in the order it is needed. The `Downloads` tab became
`Behaviour` and holds the interception mode — a preference, not part of setup.

The original worry — that folders cannot be picked before the NAS is reachable — resolved
itself: `FolderSelect` already loads the real folder list as soon as credentials work, and the
`Download` default means the field is never empty in the meantime. No gate needed.

**Questions that no longer apply** (both were artefacts of gating the folders):

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

**Size:** L · **Area:** ui · **Status:** Done
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

**2026-08-28 — done.** `src/popup/ui/Tabs.svelte` implements the ARIA tabs pattern generically
(roving `tabindex`, arrows, Home/End). Panels stay mounted and are hidden with the `hidden`
attribute rather than `{#if}`, so switching tabs never drops typed values or validation state.

Both constraints above are covered by a test that fails without them: emptying Temp Folder on
the Downloads tab, returning to Connection and pressing Save must switch tabs *and* focus the
field. `await tick()` before `focus()` is load-bearing — Svelte removes `hidden` asynchronously,
so focusing straight away lands in a panel that is still hidden and is silently dropped.

---

### UX-14 — Export/Import sits between real settings

**Size:** S · **Area:** ui · **Status:** Done

Backup is a top-level section of equal weight to Connection, so a rarely used maintenance
action occupies prime space in a list the user scrolls constantly.

**Synology puts it under Advanced**, titled "Settings Store snapshot", subtitled *"This is an
advanced setting meant for debugging purposes only"*, and warns before importing:
*"⚠️ Warning: Importing a settings snapshot will overwrite your current settings"*.

We have no such warning — import silently replaces the form.

**Direction:** move Export/Import into an Advanced group (folded by default, part of UX-13) and
add the overwrite confirmation before an import is applied.

**2026-08-28 — done.** Backup moved under the Advanced tab with UX-13. The import now parses
the file, holds the result, and names what it will replace ("Server address, Username, Routing
rules (2)") before anything is touched; Cancel leaves the form untouched, Replace applies it to
the form only, and Save still persists it.

Naming the changes rather than warning generically matters because the file is opaque: the user
picked it from disk and cannot see what is inside.

Found while testing: the popup has **two** file inputs — this one and the torrent upload — so an
unqualified `input[type=file]` selector reaches the wrong one. The import input is now
`#import-input`.

---

### UX-15 — Torrent-link handling is guessed at, not derived from tracker sources

**Size:** M · **Area:** testing · **Status:** Done
**Raised:** 2026-08-28 (owner)
**2026-08-29 — done.** Replaced the remembered `/dl.php` special case in `isTorrentSource()`
with source-backed general detection, backed by primary-source inspection of tracker engines
(TorrentPier) and RFC standards (RFC 6266 / RFC 5987).

**Primary sources inspected:**
- **TorrentPier** (`src/Http/Response.php` in `https://github.com/torrentpier/torrentpier`, official
  archived repo): both file and dynamically generated torrent responses send `Content-Type:
  application/x-bittorrent`; Symfony builds an attachment `Content-Disposition` with a sanitized
  Unicode filename and ASCII fallback.
- **RFC 6266 Section 4.3** (`https://datatracker.ietf.org/doc/html/rfc6266#section-4.3`):
  specifies disposition parameter handling; `filename*` using RFC 5987 encoding takes precedence
  over legacy `filename`. Recipients must strip directory components to prevent path traversal.
- **RFC 5987 Section 3.2** (`https://datatracker.ietf.org/doc/html/rfc5987#section-3.2`):
  specifies extended parameter format `filename*=charset'[language]'value-chars` supporting UTF-8
  and ISO-8859-1 percent-encoding.

**Implementation & regression coverage:**
- `src/lib/torrentSender.ts`: `isTorrentSource(url, mime, filename)` prefers known
  `application/x-bittorrent` and `application/x-torrent` MIME types (ignoring parameters like charset),
  Chrome-provided filename with `.torrent` extension (derived from `Content-Disposition`), and URL
  extension (supporting query strings/fragments). TorrentPier's source-backed `/dl.php` route remains
  a URL-only context-menu fallback, but explicit non-torrent MIME/filename metadata overrides it.
- `torrentFileName()` fully parses RFC 6266 / RFC 5987 `filename*` parameters, respects precedence
  over `filename`, handles percent decoding (UTF-8, ISO-8859-1), and sanitizes path traversals.
- `src/lib/torrentSender.test.ts`: table-driven suite covering direct URLs, opaque endpoints detected
  by MIME or Chrome's resolved filename, query/fragment-bearing final URLs, and negative non-torrent
  cases (including PDF via `dl.php`).
- **Magnet boundary:** verified that magnets are submitted directly to QNAP Download Station V4
  `/Task/AddUrl` without local bencode parsing or SHA-1 info_hash derivation, because DS V4 natively
  resolves magnet URIs. Tested that `isTorrentSource` treats magnets as URLs rather than binary download
  streams.

---

### UX-16 — Settings held things that did not justify being there

**Size:** M · **Area:** ui · **Status:** Done
**Raised:** 2026-08-28 (owner): "удали все что не обосновывает свое нахождение там"

Audit of everything on the settings screen, keeping only what a user can act on and would
look for there.

**Removed — "Recent activity".** It first moved out of Settings, then the follow-up audit removed
the feature entirely: UI, storage, background writes, and tests. It duplicated the task list and
failure channels, was only refreshed on mount, and could retain full signed URLs through its
`name` field despite the module claiming URLs were never stored.

**Removed — the "Remember password" checkbox.** Turning it off kept the password in session
storage only, so after a browser restart the service worker had nothing to log in with and
every intercepted torrent silently stayed in Chrome. That is the exact failure the master
password was removed for. An option whose "off" state breaks the extension's main function is
not a choice worth offering: the password is now always stored.

`rememberPassword` is gone from `Settings` entirely — the type, the defaults, the load and save
paths, the backup allow-list and the client signature. Storage written by an older version
keeps the stale key harmlessly; nothing reads it.

**Kept, with reasons:**

| Item | Why it stays |
| --- | --- |
| Server address, username, password | The connection cannot be derived |
| Temp / Target folder | Required by Download Station; defaults do not fit every NAS |
| Intercept checkbox | The one behaviour a user genuinely turns off |
| Theme | Preference with immediate effect |
| Protect settings | Opt-in, and the only thing guarding the credentials on a shared machine |
| Routing rules | The feature's whole point for anyone who uses it |
| Export / Import | Recovery and moving between machines; correctly under Advanced |
| Version line | The first thing to ask for in a bug report |

**2026-08-28 — theme lifted out of the tabs.** With the theme applying on selection, an
Appearance tab held one instant control that Save has nothing to do with — navigation for its
own sake. It now sits in a header row above the tab list, which leaves two tabs: **Connection**
(everything a first run needs) and **Advanced** (what most users never open).

---

### UX-17 — No control over how aggressively a `.torrent` is intercepted

**Size:** M · **Area:** settings · **Status:** Done
**Files:** `src/lib/config.ts` (`torrentInterceptMode`), `src/popup/features/settings/Settings.svelte`,
`src/background/downloads.ts`
**Depends on:** BUG-30 (the mechanism this setting exposes)

`torrentInterceptMode` is `"off" | "always"` today. `"always"` still lets Chrome commit the
download — so the user can get a "Save as" dialog and a file on disk even though the torrent
went to the NAS (see BUG-30). There is no way to ask for a *clean* hand-off.

**Proposal:** a third level, surfaced as a checkbox under the existing interception control —
something like *"Don't save the .torrent file locally"*, off by default.

- **unchecked (default, current behaviour)** — pause → hand off → cancel. Safest: if the NAS
  is unreachable the browser download simply resumes and the user still gets their file. This
  stays the default precisely because the failure mode is benign.
- **checked (full)** — cancel at `onDeterminingFilename` before the file is ever committed,
  then hand the URL to the NAS. No dialog, no local copy. The cost is that a failed NAS hand-off
  requires the user to click the link again.

**Why a setting rather than just fixing it:** the aggressive path trades a benign failure mode
(stray file) for a worse one (a download that appears to hang while the NAS is timing out).
That is a real trade-off, so it belongs to the user, not to us.

**Open questions to settle before coding:**
1. Checkbox vs. a three-way radio. A checkbox reads better but hides that these are ordered
   levels; `torrentInterceptMode` is already a string union, so a third value is cheap.
2. Chrome-only. Firefox has no `onDeterminingFilename` — hide the control there, or show it
   disabled with a reason? Leaning: hide, since a dead control is worse than an absent one.
3. Should the demo recording use this setting, or a build flag? Leaning: the setting — a
   promo must show shipping behaviour, not a hidden mode (see DEMO-1).
4. Wording: "don't save locally" describes the effect; "full interception" describes the
   mechanism. Prefer the effect.

**2026-08-30 — implementation decisions.** Shipped as a separate boolean
`suppressLocalTorrentFile`, not a third `torrentInterceptMode` value: the mode answers
*whether* to intercept, this answers *how hard*, and folding them into one enum would have made
"off + strict" representable but meaningless.

1. **Checkbox, not a radio group** — matches the existing "Send .torrent downloads to the NAS"
   and "Protect settings" controls, and the two states read as a sentence.
2. **Hidden on Firefox**, not disabled — gated on `chrome.downloads.onDeterminingFilename`
   being present. A dead control invites the question "why can't I tick this".
3. **Nested under its parent**, indented and always visible in Chromium. It is disabled until
   interception is on and explains that dependency, so the option remains discoverable without
   looking like an independent setting.
4. **Wording describes the effect**, per the leaning above: "Don't keep the .torrent file
   locally", followed by a concise hint: no prompt or local copy; if the NAS cannot accept it,
   click the link again.

**Defaults:** torrent forwarding starts **on**; strict local-file suppression starts **off**;
the settings lock starts **off**. See BUG-30 for the mechanism and for the 15-second determiner
timeout that shaped strict mode. UX-17 remains In Review until BUG-30's strict path is exercised
in a real Chrome profile.

**2026-09-09 — Done.** The card's own closing line was "UX-17 remains In Review until BUG-30's
strict path is exercised in a real Chrome profile". It now is, automatically and in CI, with a
control arm — see BUG-30 for the mechanism and for the one half that automation still cannot
reach (the Save-as dialog, which a headless browser cannot show).

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### UX-18 — The rule editor teaches patterns that cannot match

**Size:** M · **Area:** ui · **Status:** **Done**
**Files:** `src/popup/features/settings/Settings.svelte:728-758`
**Depends on:** BUG-47 (what the matcher can actually see decides what the hint may promise)

Every rule shows the same placeholder, `e.g. *.mkv`, regardless of the selected type. For a
magnet the only available name is the `dn` parameter, which carries no extension and is often
missing; for a `.torrent` link the name is the URL slug, which ends in `.torrent`. A user
follows the example, saves, and gets silence — no match, no error, no explanation.

The three controls also have no visible labels at all: they are identified by placeholder,
which disappears the moment anything is typed.

**What to build**

- A header row above the grid — Type / Name / Domain — so the fields are labelled when full,
  not only when empty.
- A hint under the Name field that changes with the selected type, and says what the pattern is
  actually compared against. After BUG-47 the `.torrent` hint changes from a warning into a
  promise ("the name inside the torrent"), so word it so it survives that change.
- The magnet/domain limitation stated the same way, and reachable by assistive tech (BUG-53).

**Acceptance criteria**

- [ ] Every condition control has a visible label that stays visible.
- [ ] The Name hint names its source per type and is not a generic example.
- [ ] No hint promises a match the engine cannot perform.

**2026-09-09 — Done, trimmed to what the new syntax needs.** Shipped: column headers over the
three condition fields (Source / Name or extension / Site), and one hint line under the grid
showing the list syntax with real examples. The fields are renamed accordingly — "Site" rather
than "Domain", because it matches the originating page as much as the file's host.

Cut from the original scope: per-type hint text. It existed to warn that `*.mkv` cannot match a
`.torrent` or a season pack, and both warnings are now false — a `.torrent` routes on its own
`info.name` (BUG-47) and a pack is caught by `*S0?E0?` in the same field. One honest hint beat
three conditional ones.

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### UX-19 — Rules are write-only — nothing tells you whether they work

**Size:** M · **Area:** ui · **Status:** Deferred
**Files:** `src/popup/features/settings/Settings.svelte` (rules section), `src/lib/routingRules.ts`
(`resolveDestination`, already pure and exported)

The only feedback about a rule ever firing is `console.log("[QuickGet] … targetFolder")` in the
service worker. A user of a published extension will never see it. Rules are configured, saved,
and then believed in.

**What to build:** one input at the top of the rules section — paste a link, see the answer.
"`magnet:?xt=…&dn=Some.Show.S01E01` → **rule 2** → `Multimedia/TV`", or "no rule matched — goes
to Target folder". Highlight the card that won.

The engine work is already done: `resolveDestination` is pure, synchronous and takes exactly the
input this needs. What is missing is that it returns a string rather than which rule produced
it — return the index, and the UI is a text field plus a line of output.

**Do this before adding any more matchers.** It is the cheapest change that turns the feature
from guesswork into something a user can verify, and every later routing change becomes
testable by hand instead of by console.

**Acceptance criteria**

- [ ] A pasted URL, magnet or `.torrent` link reports the winning rule and the destination.
- [ ] "No rule matched" is an explicit answer, not an empty result.
- [ ] The tester uses the same code path as the background send — no second implementation.
- [ ] Testing a link never writes anything to storage or the NAS.

**2026-09-09 — Deferred, on the product owner's call.** "First phase: user-friendly rules,
extensions are enough." A tester is a debugging aid: you notice its absence only once something is
already wrong, and no competitor has one, so it is beyond parity rather than part of it.

The engine change it needs stayed unbuilt on purpose — `resolveDestination` still returns a string
rather than the winning rule's index. Reviving this card starts by splitting that, which is a few
lines; the UI is the rest. **Revive it if rules start being written that do not behave as
expected** — that is the symptom it treats.

**2026-09-09 — deferral reinforced.** BUG-38 puts the destination on every task card, so the
question the tester exists to answer — "did my rule do what I meant" — now has an answer from real
traffic, continuously, for free. A tester answers it faster and for links you have not sent yet;
that is a smaller gap than it was this morning.

---

### UX-20 — Which rule sent a task, and where, is invisible

**Size:** S · **Area:** ui · **Status:** Rejected
**Related:** BUG-38 (destination path omitted from task details), GAP-6 (destination choice on
the automatic paths)

`Task/Query` already returns `move` and `path` per task (`src/api/schema.d.ts:50-51`), so the
folder a task landed in is one field away from being shown — that half is BUG-38. What this
card adds is *why* it landed there: with routing rules shipped, "wrong folder" now has two
possible causes, a bad rule or a bad default, and the popup distinguishes neither.

A wrong destination is only cheap to fix while the download is still small, which makes
visibility worth more here than it looks.

**Acceptance criteria**

- [ ] A task shows the folder it was sent to without opening Settings.
- [ ] When a rule decided it, the task says which one.
- [ ] Adds no extra NAS request — the data is already in the poll response.

**2026-09-09 — Rejected.** Two halves, and they part company on cost.

*Where a task went* is one field: `Task/Query` already returns `move` and `path`, they are simply
not mapped in `tasks.ts`. That is BUG-38 and it stays open.

*Which rule chose it* is the contortion. The routing decision is made in the background at send
time; the task on the NAS is identified later by a name that, for a magnet, is not even the same
string. Correlating them means keeping a side map from task to decision, expiring it, and
surviving a service-worker restart — machinery whose only output is a line of explanatory text.
The tester (UX-19) answers the same question offline and exactly, whenever it is built.

**2026-09-09 — the half worth keeping shipped.** "Where a task went" is on the card (BUG-38,
Done). What stays rejected is only "which rule chose it", for the reason above.

---

### UX-21 — A rule cannot be muted or duplicated

**Size:** S · **Area:** ui · **Status:** Rejected
**Files:** `src/lib/routingRules.ts` (`RoutingRule`, `sanitizeRoutingRules`),
`src/popup/features/settings/Settings.svelte`
**Depends on:** UX-19 (a muted rule needs somewhere to be visibly muted)

To stop a rule from firing you have to delete it and type it back later — there is no way to
turn one off while diagnosing, and no way to copy one that differs by a single field. Both are
routine when a set of rules stops behaving.

`enabled?: boolean` on the rule shape, defaulted to `true` by the sanitizer so existing stored
data keeps working, plus a toggle and a duplicate action on the card. A disabled rule must be
skipped by `resolveDestination` and shown as skipped by the tester from UX-19.

**Acceptance criteria**

- [ ] A muted rule is skipped by the engine and visibly muted in the editor.
- [ ] Stored rules written before this change load as enabled.
- [ ] A duplicated rule lands directly below its source and does not inherit its id.

**2026-09-09 — kept, and it is genuinely small.** `enabled?: boolean` on the rule, defaulted to
true by the sanitizer so stored data keeps working, a toggle on the card, and one condition in the
matcher. No new concepts.

Its value went **up** when UX-19 was deferred: with no tester, muting a rule is the only way to
find out which one is doing something unexpected. That is the argument for it — not tidiness.
Duplicate is the cheaper half of the same card and can ship alone.

**2026-09-09 — the case for it narrowed but did not vanish.** The argument was "with no tester,
muting is the only way to find which rule misbehaves". With the destination now visible on every
card (BUG-38), you can *see* the wrong folder without muting anything — but you still cannot tell
*which* rule chose it, and bisecting by muting is the cheapest way to find out. Still easy, still
worth it, no longer the only diagnostic.

**2026-09-09 — Rejected.** The case for it moved twice in one day and ended below the cost.

It was "with no tester, muting is the only way to find which rule misbehaves". Then BUG-38 put the
destination on every card, so a wrong folder is *visible* without muting anything. What is left is
"which of my rules chose it", on a list that is short and ordered and readable.

The cost is not nothing: `enabled` in the stored rule shape, a default in the sanitizer so old data
keeps working, a branch in the matcher, a state in the editor, tests for each. A schema change to
serve a diagnostic. Duplicate is pure convenience and does not carry the card on its own.

Reopen if rule sets start being long enough that reading them is the hard part.

---

### UX-22 — Rule-editor affordances worth borrowing from Send To QNAP++

**Size:** S · **Area:** ui · **Status:** Rejected
**Source:** `docs/competitor-routing-teardown.md` section D
**Related:** UX-18 (labels and hints), UX-19 (the rule tester), BUG-52 (no discard path)

The 2026-09-09 teardown found their *engine* weaker than ours — one condition per rule, no AND, a
`break` where a `continue` belongs that makes any domain rule shadow everything below it for
magnets — but their *editor* does four small things we do not, each cheap and each aimed at the
same problem: rule syntax is what users get wrong.

- **Per-field `?` help with worked examples** (`Configure_QNAP_Access.html:612`): five concrete
  patterns with plain-English glosses, next to the field, rather than a doc page nobody opens.
- **Show the fallback inline on a rule with no destination** (`js:1150-1157`): the default folder
  rendered greyed in the empty field, so "no destination" explains itself instead of looking
  broken. Ours simply refuses to save, which is stricter and less informative.
- **Nudge an unverified folder** (`js:1025-1031`): once a path is typed but not checked, highlight
  the validate control. It prompts before an error rather than reporting one after — complementary
  to our F1 red ring, not a replacement.
- **Live rule count in an `aria-live` region** (`js:1120-1129`): "3 rules". One line, and it gives
  the live region something to say when a rule is added or removed.

Also worth confirming rather than copying: their validation distinguishes *not found* from *exists
but is a file* (`common.js:738`, File Station `isfolder`). Our `Misc/Dir` check should be able to
say which, and currently reports both as a bad path.

**Not to be copied:** validation that is advisory only. They let a rule with a folder that failed
verification be saved anyway, and a committed rule carries no validity indicator at all.

**Acceptance criteria**

- [ ] Pattern syntax is explained where it is typed, with examples, not only in a hint line.
- [ ] A rule with no destination shows what it would fall back to.
- [ ] The live region reports the rule count alongside add/remove/move.
- [ ] Nothing here duplicates UX-18's labels or UX-19's tester — check both before starting.

**2026-09-09 — Rejected after re-reading the teardown against what we actually shipped.** Of the
four affordances:

- **`?` help with worked examples** — superseded by UX-18's hint line, which puts the same
  examples in the same place without a popover to open.
- **Show the fallback destination in an empty field** — does not apply to us. `++` treats an empty
  destination as "use the default"; our validator requires one, which is the stricter and clearer
  contract. There is no empty state to explain.
- **The unverified-folder nudge** — duplicates the red ring F1 already shows, and adds a second
  visual state to the same field.
- **Live rule count in the live region** — the region already announces add, remove and reorder by
  name and position, which is more useful than a total.

Recorded rather than silently dropped: the teardown is worth trusting on the engine, and it was
right that we were behind on multi-value fields. It is not automatically right about the editor.

---

### UX-23 — Shift-click sends one link, whatever the automatic settings say

**Size:** M · **Area:** settings · **Status:** In Review
**Files:** `src/content/magnet.ts`, `src/background/index.ts`, `src/background/menus.ts`,
`src/popup/features/settings/Settings.svelte`

**The idea is the product owner's, and it is the inverse of what was first built.** The initial
design read Shift as an escape hatch — interception on, Shift keeps the file local. The right
reading is an opt-in escalation: **the checkboxes decide whether links are taken automatically,
Shift takes the one under the cursor regardless.** That makes the default far less consequential.
Someone who does not want automatic interception turns it off and still uses the extension with a
modifier, without a trip to Settings or the context menu for every link.

**The rule, in one line:** the checkbox means "don't ask", Shift means "this one".

|  | plain click | Shift-click |
|---|---|---|
| off | browser | **sent to the NAS** |
| on | sent to the NAS | sent to the NAS |

The fourth cell is deliberately not an inversion. "Interception is on but I want *this* file
locally" is a rare wish with an existing answer — turn the checkbox off — and serving it would
mean a second mechanism: a short-lived "do not touch this download id" map and a real race with
service-worker suspension. If it turns out to matter it can be added on top without disturbing
any of this.

**Decisions worth keeping**

- **Shift and nothing else.** Ctrl, Cmd and Alt keep their native browser meanings — new tab, new
  window, download the link. All three modifiers were already taken, and Shift's native meaning
  on a torrent link (open in a new window) is the least useful of them.
- **One rule for both link kinds.** Magnets previously treated *every* modifier as "leave it
  alone", so Shift-clicking a magnet did the exact opposite of the new gesture. `isEligibleClick`
  now lets Shift through, so a magnet and a `.torrent` behave the same way.
- **The click is cancelled and the URL goes to the worker**, which sends it down the same path as
  the context menu (`sendDownloadToStation`). No downloads API, no id juggling, no race — and a
  `.torrent` still gets fetched in the page's own session for trackers behind a login.
- **The listener is attached unconditionally.** Gating it on `autoCaptureMagnets` left the gesture
  dead in precisely the configuration it exists for. The setting is now checked in the handler,
  where it decides what an *ordinary* click does.

**Known limit, worth stating rather than hiding:** the content script recognises a torrent from
the href alone — a `.torrent` ending or TorrentPier's `/dl.php`. An opaque endpoint that reveals
itself only through a response MIME type is, from inside the page, indistinguishable from any
other link, and Shift-clicking one does nothing. Preventing every Shift-click on the web to find
out is not a trade worth making. If it proves to matter, the fallback is to let the download start
and escalate it by id.

**Discoverability:** nobody finds a modifier gesture on their own, so it is stated under the
interception checkbox — "Hold Shift when clicking any torrent or magnet link to send just that
one — whether these are on or off" — and the existing in-page toast reports the result.

**Covered by** unit tests for `getShiftSendUrl` and the modifier rule in `isEligibleClick`, and an
E2E that sends both a `.torrent` and a magnet **with both automatic modes off**, asserting a plain
click sends nothing first.

**Next in this chain:** with a per-click way in, the three interception checkboxes can collapse
into one. That is the follow-up, not this card.
