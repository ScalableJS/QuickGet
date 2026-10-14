---
type: "task"
id: "BUG-35"
status: "done"
priority: "p2"
area: "popup/UX"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Peer and seed counts provided by NAS are never displayed in the popup

**Severity:** medium · **Area:** popup/UX
**Files:** `src/lib/tasks.ts`, `src/popup/components/downloadItem/format.ts`,
`src/popup/components/downloadItem/DownloadItem.svelte`

QNAP Download Station V4 returns `peers` and `seeds` counts for torrent tasks in `Task/Query`.
Currently, the popup displays transfer speed and ETA, but completely omits peer and seed metrics.
When a torrent is stalled or slow (0 KB/s), users cannot tell whether the swarm has 0 seeds or is
simply negotiating connections.

**Resolved 2026-09-05** —
1. `src/popup/components/downloadItem/format.ts`: Added `formatSwarm()` formatting swarm telemetry (`S 12 · P 4` for active torrents, `P 4` for seeding).
2. `src/popup/components/downloadItem/DownloadItem.svelte`: Rendered compact monospace tabular telemetry in top card row next to the task name.
3. Unit tests in `format.test.ts` and Storybook stories (`DownloadingActive`, `DownloadingStalled`, `SeedingQuota`).
