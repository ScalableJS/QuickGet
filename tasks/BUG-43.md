---
type: "task"
id: "BUG-43"
status: "done"
priority: "p1"
area: "popup/UX"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Routing rules UX in popup: cramped single-line layout, missing priority reorder controls, and silent rule drop

**Severity:** high · **Area:** popup/UX
**Files:** `src/popup/features/settings/Settings.svelte`, `src/popup/features/folderPicker/FolderSelect.svelte`

The previous Routing Rules interface in the popup (~360–400px width) had critical usability issues:
1. **Cramped horizontal layout:** Three inputs (`Select` type, `Field` filename, `Field` domain) were squeezed into a single row alongside the delete button.
2. **No priority reordering:** The rule engine operates on "First matching rule wins", but the UI provided no way to reorder rules (no Move Up / Move Down buttons).
3. **Ambiguous condition logic:** Users could not tell whether conditions are combined with AND or OR.
4. **Data loss on incomplete rules:** Clicking "Save" when `destination` was blank silently dropped the rule without user confirmation or validation error.
5. **Incompatible conditions (Magnet + Domain):** Selecting type `magnet` while filling `domain` created an impossible condition (magnets have no host).

**Resolved 2026-09-08** —
1. `src/popup/features/settings/Settings.svelte`: Implemented vertical card layout (`IF ... THEN SAVE TO`) with `Rule N` header, microcopy `matches all filled (AND)`, and full-width `FolderSelect`.
2. Added accessible Move Up / Move Down icon buttons with boundary disable logic (`i === 0` and `i === length - 1`), plus Remove button with destructive hover tone.
3. Added transactional validation: incomplete destination or empty conditions render inline `role="alert"` errors, focus the invalid field, and never drop rows.
4. When `type === "magnet"`, disabled Domain field with hint *"Domain matching is not applicable to magnet links"* and cleared domain upon serialization.
5. Verified with Playwright E2E tests in `tests/e2e/routing-rules.spec.ts` and Storybook stories.
