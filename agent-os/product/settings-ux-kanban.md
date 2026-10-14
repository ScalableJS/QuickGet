# Settings UX — Kanban

Board for the settings form: validation, grouping, accessibility, and the state model behind
the connection fields. Analysis behind these cards is in `docs/settings-ux-plan.md`; the
states they change are visible in Storybook under `Features/Settings`.

Task files are canonical; this document keeps board context, historical notes, and stable card links.

---

## Board

Open [the task board](../../views/tasks.base) and filter `board` by `settings-ux`.
The frontmatter of [task files](../../tasks/README.md) owns status.

## Cards

### UX-1 — `Field` cannot show an error, hint, or required state

[UX-1](../../tasks/UX-1.md) — canonical task and status.

### UX-2 — Form validation approach: hand-rolled vs schema library

[UX-2](../../tasks/UX-2.md) — canonical task and status.

### UX-3 — Sections are headings, not field groups

[UX-3](../../tasks/UX-3.md) — canonical task and status.

### UX-4 — Validation only runs on Save, and reports everything at once

[UX-4](../../tasks/UX-4.md) — canonical task and status.

### UX-5 — Status messages are never announced

[UX-5](../../tasks/UX-5.md) — canonical task and status.

### UX-6 — Routing rules are unnamed field soup for screen readers

[UX-6](../../tasks/UX-6.md) — canonical task and status.

### UX-7 — Connection has no connected/disconnected state model

[UX-7](../../tasks/UX-7.md) — canonical task and status.

### UX-8 — Master password protects settings, not downloads

[UX-8](../../tasks/UX-8.md) — canonical task and status.

### UX-9 — a11y regression gate in CI

[UX-9](../../tasks/UX-9.md) — canonical task and status.

### UX-10 — Notifications fire on every outcome, including success

[UX-10](../../tasks/UX-10.md) — canonical task and status.

### UX-11 — No activity history in the popup

[UX-11](../../tasks/UX-11.md) — canonical task and status.

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

[UX-12](../../tasks/UX-12.md) — canonical task and status.

### UX-13 — Settings are one long scroll with no collapsing and a stranded Save

[UX-13](../../tasks/UX-13.md) — canonical task and status.

### UX-14 — Export/Import sits between real settings

[UX-14](../../tasks/UX-14.md) — canonical task and status.

### UX-15 — Torrent-link handling is guessed at, not derived from tracker sources

[UX-15](../../tasks/UX-15.md) — canonical task and status.

### UX-16 — Settings held things that did not justify being there

[UX-16](../../tasks/UX-16.md) — canonical task and status.

### UX-17 — No control over how aggressively a `.torrent` is intercepted

[UX-17](../../tasks/UX-17.md) — canonical task and status.

### UX-18 — The rule editor teaches patterns that cannot match

[UX-18](../../tasks/UX-18.md) — canonical task and status.

### UX-19 — Rules are write-only — nothing tells you whether they work

[UX-19](../../tasks/UX-19.md) — canonical task and status.

### UX-20 — Which rule sent a task, and where, is invisible

[UX-20](../../tasks/UX-20.md) — canonical task and status.

### UX-21 — A rule cannot be muted or duplicated

[UX-21](../../tasks/UX-21.md) — canonical task and status.

### UX-22 — Rule-editor affordances worth borrowing from Send To QNAP++

[UX-22](../../tasks/UX-22.md) — canonical task and status.

### UX-23 — Shift-click sends one link, whatever the automatic settings say

[UX-23](../../tasks/UX-23.md) — canonical task and status.

### UX-24 — Three interception checkboxes become one

[UX-24](../../tasks/UX-24.md) — canonical task and status.

### UX-25 — Routing fields should use forgiving hybrid matching

[UX-25](../../tasks/UX-25.md) — canonical task and status.

### UX-26 — Sections have no standard rhythm or surface

[UX-26](../../tasks/UX-26.md) — canonical task and status.
