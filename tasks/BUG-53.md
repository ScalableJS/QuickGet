---
type: "task"
id: "BUG-53"
status: "done"
priority: "p3"
area: "popup/a11y"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "low"
---

# Rule editor a11y polish batch: focus, labels, dead class, literal caps

**Severity:** low · **Area:** popup/a11y
**Files:** `src/popup/features/settings/Settings.svelte:688,725,746,760-768,778`

Small items, each cheap, grouped so they are not five cards:

- **Add rule moves nothing.** The new card appears at the bottom of the list, focus stays on
  the button, and nothing is announced — indistinguishable from a no-op without sight.
- **The disabled Domain field cannot explain itself.** `disabled` removes it from the tab
  order, and the sentence that says why (`:766`) is not connected by `aria-describedby`, so
  assistive tech never encounters either.
- **Duplicate rule name.** `<legend class="sr-only">Rule N</legend>` (`:688`) sits next to a
  visible `Rule N` span, so the group announces its name twice.
- **`visually-hidden` is a dead class** — not a UnoCSS utility; only the `sr-only` beside it
  does anything. Remove it or the next reader will assume it works.
- **Literal capitals.** "IF" (`:725`) and "THEN SAVE TO" (`:778`) are uppercase in the source
  *and* carry the `uppercase` class. Write them in sentence case and let CSS do the shouting,
  so a screen reader does not spell out a two-letter word as an abbreviation.
- **No visible labels at all** — the three condition controls are identified by placeholder
  only, which disappears on input. The column-header fix belongs to UX-18.

**Acceptance criteria**

- [x] Adding a rule focuses the new card's first control and announces it.
- [x] The magnet/domain limitation is reachable by assistive tech.
- [x] Each rule group announces its name once.
- [x] No dead utility classes; no literal uppercase carrying meaning.


**2026-09-09 — fixed. **Done 2026-09-09**,** Adding a rule now focuses the new card's type control and
announces itself. The magnet note carries an id and is referenced by the domain field's
`aria-describedby`, and it says what actually happens now ("kept but not applied"). The visible
`Rule N` span is `aria-hidden`, leaving the `<legend>` as the group's only name. The dead
`visually-hidden` class is gone. "IF" / "THEN SAVE TO" are written "If" / "Then save to" with the
shouting left to the existing `uppercase` class.

Not included: visible column labels for the three condition controls. That is UX-18, which
redesigns the header row rather than adding three labels to the current layout.

**Resolved 2026-09-09** — shipped in v2.3.0.
