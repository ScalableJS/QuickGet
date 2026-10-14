---
type: "task"
id: "BUG-12"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Parallel toolbar transitions lose the newer failure state

**Severity:** high · **Area:** background
**Files:** `src/background/actions.ts`, `src/background/downloads.test.ts`

Toolbar writers independently perform `storage.session.get → mutate → set`. Two overlapping
operations can read the same revision and save in reverse order, allowing an older green
working transition to erase a newer red failure. Revision comparison cannot protect data that
was already lost by the write race.

**Reproduced 2026-08-28** — deterministic gated test overlaps the working repaint with a
parallel failure. Final persisted state is incorrectly empty at revision 0 instead of red `!`
at revision 1.

**Done 2026-08-28** — every toolbar state transition (event, poll, failure counter, clear and
reset) now passes through one same-worker queue while authoritative state remains in
`storage.session`. The deterministic overlap tests preserve the newer red revision.

**Verification:** 210/210 unit tests, 18/18 mock Chromium E2E, typecheck, Svelte check, lint and
production build all green.
