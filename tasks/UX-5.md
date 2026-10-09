---
type: "task"
id: "UX-5"
status: "done"
priority: "p2"
area: "ui"
board: "settings-ux"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# Status messages are never announced

**Size:** S · **Area:** ui
**Files:** `src/popup/components/statusPill/statusPill.ts`

The status pill is inserted imperatively with no `aria-live`, so "Settings saved" and every
error are silent to assistive tech.

**Proposal:** render it inside a container with `aria-live="polite"`, `assertive` for errors.
No changes at the call sites.
