---
type: "task"
id: "ENG-6"
status: "done"
priority: "p3"
area: "popup/scripts"
board: "engineering"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# Apply the verified low-risk local cleanup batch

**Priority:** P3 · **Size:** S · **Area:** popup/scripts
**Files:** `src/popup/features/downloads/DownloadsListShowcase.svelte`,
`src/popup/features/downloads/downloadsUI.ts`, `src/popup/features/downloads/autoRefresh.ts`,
`src/popup/features/downloads/downloadFilters.ts`, `scripts/check-contrast.mjs`

These findings were checked against current consumers and can be handled without changing an
architecture:

- replace the showcase's `$effect(() => view.tasks = tasks)` state mirroring with a derived view
  or direct input;
- reuse the existing settings-panel visibility helper instead of duplicating its DOM selector in
  `downloadsUI.ts`;
- remove the uncalled `isAutoRefreshRunning()` export;
- move the filter predicate tests/imports to `@lib/tasks` and remove compatibility-only
  predicate re-exports from `downloadFilters.ts`;
- remove the second `block(":root")` spread already contained in the contrast script's `base`.

**Acceptance:** keep this a deletion-oriented patch with no new general-purpose abstraction. The
Storybook showcase, popup behavior, contrast check and existing test suite must remain green.

**Completed 2026-09-15** — all five deletion-oriented cleanups landed; Svelte, typecheck, lint,
contrast and focused popup tests pass.
