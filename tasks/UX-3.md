---
type: "task"
id: "UX-3"
status: "done"
priority: "p2"
area: "ui"
board: "settings-ux"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# Sections are headings, not field groups

**Size:** S · **Area:** ui
**Files:** `src/popup/features/settings/Settings.svelte`

`Connection`, `Download defaults`, `Routing rules`, `Backup` are `<h2>` plus `<div>`. Measured:
zero `<fieldset>` in the popup. A screen reader cannot jump between groups and does not
associate a heading with the fields under it.

**Proposal:** `FormSection.svelte` wrapping `<fieldset>` + `<legend>`, with the browser's
fieldset defaults reset. Visually identical.
