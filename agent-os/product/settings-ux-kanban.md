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
| UX-1 | `Field` cannot show an error, hint, or required state | ui | S | Discussion |
| UX-2 | Form validation approach — hand-rolled vs schema library | ui | M | **Discussion** |
| UX-3 | Sections are headings, not field groups | ui | S | Discussion |
| UX-4 | Validation only runs on Save, and reports everything at once | ui | M | Discussion |
| UX-5 | Status messages are never announced | ui | S | Discussion |
| UX-6 | Routing rules are unnamed field soup for screen readers | ui | M | Discussion |
| UX-7 | Connection has no connected/disconnected state model | ui | L | **Discussion** |
| UX-8 | Master password is a barrier without a matching threat | settings | M | **Discussion** |
| UX-9 | a11y regression gate in CI | testing | S | Discussion |

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

**Size:** L · **Area:** ui · **Status:** Discussion

Address, username, password, master password and folders are all on screen at all times,
regardless of whether the extension can reach the NAS. Consequences seen in the field: a Save
with an empty password field wiped the stored one, and wrong credentials only surfaced later as
`error 4` in a background log.

**Proposal (from the user):** show credential fields only while disconnected, with a `Connect`
button that verifies immediately and reports the result; when connected, show
`admin@qnap.home ✓` and `Disconnect`. Folders move into a section that only appears once
connected, so Temp Folder can be picked from the NAS's real folder list instead of typed.

**Open questions:**

1. What does "connected" mean when it is persisted — a stored valid SID, or the last successful
   login? A SID expires; the settings should not look disconnected because of that.
2. Does `Disconnect` clear the stored password, or only the session? Clearing it is honest but
   costs a retype every time.
3. Offline case: the NAS is unreachable but the settings are correct. Must not read as
   "disconnected, retype everything".

**Depends on:** decision in UX-8 — the two share the same state.

---

### UX-8 — Master password is a barrier without a matching threat

**Size:** M · **Area:** settings · **Status:** Discussion

Now optional (encryption is an explicit opt-in), but the model is still built around it:
"remember" and "encrypt" are separate switches, and a locked state exists that the background
must handle on every hand-off.

**The question:** what is it defending against? The realistic attacker with access to an
unlocked browser profile can read `storage.local` regardless — and can equally read the NAS
password out of the session once it is unlocked. Against a stolen, powered-off machine, full
disk encryption already covers it.

**Positions to weigh:**

- **Keep as-is** — no work, but every code path carries a locked state that few users want.
- **Remove entirely** — simplest model: the password is stored, full stop. Loses the one real
  case, a shared machine with a shared browser profile.
- **Keep but demote** — hide it behind "Advanced", default off, and drop the locked state from
  the background path by treating a missing password as plain misconfiguration (already how
  `findConfigProblem` reports it).

**Recommendation:** demote. It preserves the capability for whoever wants it, and removes the
locked state from the code path that must never fail.

---

### UX-9 — a11y regression gate in CI

**Size:** S · **Area:** testing · **Status:** Discussion

Nothing prevents the above from regressing once fixed.

**Proposal:** add `@storybook/addon-a11y` (dev only) and run axe over the settings stories in
CI, alongside the existing gates.

**Depends on:** UX-1, UX-3, UX-5, UX-6 — pointless before there is something to protect.
