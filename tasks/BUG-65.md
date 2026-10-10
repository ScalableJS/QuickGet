---
type: "task"
id: "BUG-65"
status: done
priority: "p2"
area: "popup/a11y"
board: "bugs"
updated: 2026-10-10
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


## Polish execution: 2026-10-10

Terra owns the bounded implementation/reproduction work; Codex owns review, Mimic consultation, integrated verification and acceptance. This starts the current polish pass without closing historical evidence gaps.


## Implementation reviewed: 2026-10-10

Field, SearchField and Select expose a resting control border. The existing checkbox-border token supplies the light color, measured at 3.45:1 (previously 1.45:1); dark remains 5.57:1. Focus/invalid styles are preserved. All 26 contrast checks pass; integrated verification is recorded below.


## Accepted polish: 2026-10-10

Codex accepted the bounded source/test delta after Terra implementation and substantive Mimic consultation. Fresh integration passed 595 unit/fixture tests, 61 Chromium mock E2E, ten consecutive classifier repetitions, typecheck, Svelte (zero errors/warnings), lint, production build and six real-NAS spot checks; the owned-task ledger is empty. [The final audit](../docs/quality/code-quality-audit.md#final-integrated-acceptance) and [verification](../docs/system/verification.md#final-polish-integrated-acceptance-2026-10-10) retain exact scope and coverage limits. No release or store publication is performed.
