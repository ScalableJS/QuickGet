---
type: "task"
id: "BUG-50"
status: "done"
priority: "p2"
area: "popup/a11y"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Rule card small print fails contrast and lowercases the AND it exists to explain

**Severity:** medium · **Area:** popup/a11y
**Files:** `src/popup/features/settings/Settings.svelte:726`, `src/popup/ui/IconButton.svelte`

`:726` renders "matches all filled (AND)" at `text-10px` with `opacity-75` on
`--text-secondary`. In the light theme that is `#526276` at 75% over `--color-bg-alt`
`#eef1f6` — roughly **3.6:1** against the 4.5:1 required for text this size. Recompute rather
than trust that figure, and check dark as well.

It is not decorative text. It is the only place the editor explains that conditions combine
with AND, and the same element carries `lowercase`, which renders the "AND" as "and" and
removes the one word doing the work.

Separately, `IconButton` uses `disabled:opacity-45`; disabled controls are exempt from the
contrast requirement, but at 45% the Move Up/Down arrows read as absent rather than disabled.

**Acceptance criteria**

- [x] Contrast measured in both themes and at or above 4.5:1 for every text node in the card.
- [x] Smallest text in the rule card is at least 11px.
- [x] The AND semantics survives the styling — uppercase kept, or stated in words.
- [x] axe reports no `color-contrast` violation with the Advanced tab open (needs BUG-51).


**2026-09-09 — fixed. **Done 2026-09-09**,** The hint is now 11px with no `opacity`, inheriting
`--text-secondary`: 5.6:1 in light, 8.6:1 in dark, both above 4.5:1. It reads "all filled
conditions must match" — the AND is stated in words rather than shouted and then lowercased by a
stray utility class. `IconButton`'s `disabled:opacity-45` was deliberately left alone: it is a
shared control, disabled elements are exempt from the contrast requirement, and changing it here
would be a global restyle smuggled into a routing fix.

**Resolved 2026-09-09** — shipped in v2.3.0.
