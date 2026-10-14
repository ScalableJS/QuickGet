---
type: "task"
id: "UX-1"
status: "done"
priority: "p2"
area: "ui"
board: "settings-ux"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# `Field` cannot show an error, hint, or required state

**Size:** S · **Area:** ui
**Files:** `src/popup/ui/Field.svelte`

`Field` takes only `id`, `label`, `value`, `size`. There is nowhere to put an error, so every
failure is reported by one global status pill and no input is ever marked. Measured: zero
`aria-invalid` and zero `aria-describedby` in the whole popup.

**Proposal:** add `error?`, `hint?`, `required?`. The component renders `role="alert"` for the
error, wires `aria-invalid` and `aria-describedby` itself, and colours the border **in addition
to** the text — colour alone cannot carry the meaning (WCAG 1.4.1).

**Open question:** none. This one is a prerequisite for UX-4 and UX-6.
