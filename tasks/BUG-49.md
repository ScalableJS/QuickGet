---
type: "task"
id: "BUG-49"
status: "done"
priority: "p2"
area: "popup/a11y"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Reordering a rule drops keyboard focus and announces nothing

**Severity:** medium · **Area:** popup/a11y
**Files:** `src/popup/features/settings/Settings.svelte:216-232` (`moveRuleUp` / `moveRuleDown`),
`:694-710`

Moving a rule to the first position disables the Move Up button that currently has focus, and
Chrome drops focus to `<body>`. A keyboard user is thrown to the top of the document after one
keypress, mid-task.

Nothing is announced either. Priority order *is* the semantics of this feature — first match
wins — and changing it is completely silent, while removing a rule does post to the live region
(`:213`). The two actions should not differ.

**Acceptance criteria**

- [x] After a move, focus is on a control inside the rule that moved.
- [x] The live region says what moved and where it landed ("Rule 2 moved up — now rule 1").
- [x] Covered by a keyboard-only E2E, not a mouse-driven one.


**2026-09-09 — fixed. **Done 2026-09-09**,** `moveRuleUp`/`moveRuleDown` collapsed into `moveRule(index,
delta)`, which announces the move through the existing live region and then restores focus: the
button that performed it when it is still enabled, its sibling when the rule has reached an end.
The Move controls gained ids so focus can find them. A keyboard-only E2E asserts focus stays
inside the rule that moved and that the announcement fires.

**Resolved 2026-09-09** — shipped in v2.3.0.
