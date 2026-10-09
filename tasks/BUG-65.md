---
type: "task"
id: "BUG-65"
status: "todo"
priority: "p2"
area: "popup/a11y"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Backlog"
severity: "medium"
---

# A light-theme text input has no visible boundary (WCAG 1.4.11)

**Severity:** medium · **Area:** popup/a11y
**Files:** `src/popup/styles/tokens.css`, `src/popup/ui/Field.svelte`,
`src/popup/ui/SearchField.svelte`, `src/popup/ui/Select.svelte`, `scripts/check-contrast.mjs`

Measured, not estimated:

| Pair | light | dark |
| --- | ---: | ---: |
| `--color-control-border` `#c7d0dc` vs `--color-bg` `#f7f7f7` | **1.45:1** | 5.57:1 |
| resting textbox fill vs page (`--textbox-bg` `#ffffff` vs `#f7f7f7`) | **1.06:1** | — |

`Field`, `SearchField` and `Select` all set `border-transparent` at rest and only reveal
`--color-control-border` on hover. So in the light theme the only thing marking where an input is
sits at 1.06:1 — a boundary nobody can see. WCAG 2.2 SC 1.4.11 asks 3:1 of visual information
needed to identify a control, and this is that information. The dark theme is fine.

`scripts/check-contrast.mjs` has no rule for this pair, even though its own header says it exists
because control borders regressed to 1.40:1 unnoticed in `f20daf0`. That is the same class of
defect, still uncovered.

**Proposed fix:** give inputs a visible resting border and/or darken `--color-control-border` in
the light theme, then add `["--color-control-border", "--color-bg", 3.0, "control boundary"]` to
`RULES` so it cannot regress again. Leave the dark theme alone unless the numbers say otherwise,
and do not trade away the focus ring or the `aria-invalid` border to get there.

Found while measuring contrast for UX-26; deliberately left out of that change because it is a
palette decision, not a spacing one.
