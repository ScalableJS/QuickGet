---
type: "task"
id: "BUG-34"
status: "done"
priority: "p2"
area: "popup/UX"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Seeding tasks vanish from "In progress" and obscure seeding progress/ETA metrics

**Severity:** medium · **Area:** popup/UX
**Files:** `src/lib/tasks.ts`, `src/popup/styles/tokens.css`, `src/popup/ui/ProgressBar.svelte`,
`src/popup/components/downloadItem/format.ts`, `src/popup/components/downloadItem/DownloadItem.svelte`

When a download completes and enters QNAP state 100 (`seeding`), `isInProgress()` evaluates to
false because `seeding` was previously classified under `isCompleted()`. The task immediately disappeared
from the default "In progress" popup tab, creating the perception that the download hung or failed
without result.

Live NAS investigation (2026-09-04) confirmed that QNAP Download Station V4 emits active seeding
lifecycle metrics:
- `progress`: 0–100% of the configured seeding quota (`share_time` or `share_ratio`).
- `eta`: Remaining seeding time in seconds until the quota is satisfied (e.g. 1370s for a 30m limit).
- `activity_time`: Elapsed seeding duration in seconds.
- `total_up` / `up_rate` / `share`: Uploaded volume, current speed, and actual share ratio.

Previously, `format.ts` unconditionally forced `progress` to 100% and cleared `etaText` for `seeding`
tasks, preventing users from seeing remaining seed time or seeding quota completion progress.

**Resolved 2026-09-04** —
1. `src/lib/tasks.ts`: Included `"seeding"` in `IN_PROGRESS_STATUSES` so active seeding tasks remain visible in the "In progress" tab and contribute to active task counts until quota or manual stop.
2. `src/popup/styles/tokens.css` & `src/popup/ui/ProgressBar.svelte`: Added dedicated emerald/mint design tokens (`--progress-track-seeding`, `--progress-fill-seeding`) and a `"seeding"` variant for `ProgressBar` to visually distinguish seeding quota progress from active download progress.
3. `src/popup/components/downloadItem/format.ts` & `DownloadItem.svelte`: Preserved `task.progress` and formatted seeding remaining ETA (`view.etaText`) into the status line (`• ETA: 22m 21s`).
4. Unit tests in `format.test.ts` and `downloadFilters.test.ts` verified against live NAS payload snapshots.
