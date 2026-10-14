---
type: "task"
id: "UX-9"
status: "done"
priority: "p2"
area: "testing"
board: "settings-ux"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# a11y regression gate in CI

**Size:** S · **Area:** testing

Nothing prevents the above from regressing once fixed.

**Proposal:** add `@storybook/addon-a11y` (dev only) and run axe over the settings stories in
CI, alongside the existing gates.

**Depends on:** UX-1, UX-3, UX-5, UX-6 — pointless before there is something to protect.

**2026-09-09 — shipped, and narrower than it looks.** `@storybook/addon-a11y` with
`a11y: { test: "error" }` plus `tests/e2e/a11y.spec.ts` (axe over the real popup) are both in
place. But the E2E pass only scans the tab that happens to be open, and `Tabs` hides the others
with the `hidden` attribute, which axe skips. The routing rules have therefore never been
scanned by this gate. Fixed under BUG-51; the lesson worth keeping is that seeding state into
storage is not the same as rendering it where axe can see it.
