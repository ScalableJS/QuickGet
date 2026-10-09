---
type: "task"
id: "ENG-2"
status: "done"
priority: "p2"
area: "popup"
board: "engineering"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# Remove the dead standalone unlock mount

**Priority:** P2 · **Size:** S · **Area:** popup
**Files:** `src/popup/features/unlock/index.ts`, `src/popup/index.html`,
`src/popup/features/settings/index.ts`

`initializeUnlock()` and `UnlockFeature` have no consumer. Settings mounts `Unlock.svelte`
directly into `#settings-panel`; the separate `#unlock-panel` and its stale HTML comment are
unreachable.

**Acceptance:** remove the unused unlock entrypoint and placeholder without moving or rewriting
the live `Unlock.svelte` component. Locked settings must still mount into `#settings-panel`, unlock
success must still replace it with Settings, and popup initialization tests must stay green.

**Completed 2026-09-15** — removed the unused entrypoint and placeholder; the live Settings-owned
unlock mount and popup build remain green.
