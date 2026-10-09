---
type: "task"
id: "BUG-36"
status: "done"
priority: "p2"
area: "popup/UX"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Download payload size and progress in bytes (`done` / `size`) are hidden during download

**Severity:** medium · **Area:** popup/UX
**Files:** `src/popup/components/downloadItem/format.ts`,
`src/popup/components/downloadItem/DownloadItem.svelte`

While a task is actively downloading, `DownloadItem` displays the percentage progress bar and the
total file size, but never shows the actual downloaded volume in bytes (`done` or `down` from QNAP API).
Users cannot see "1.2 GB / 3.8 GB", which is the standard indicator in modern torrent clients
(Transmission, qBittorrent, Synology DS).

**Resolved 2026-09-05** —
1. `src/popup/components/downloadItem/format.ts`: Added `formatTaskSize()` displaying `done / size` (e.g. `16.6 GB / 22.6 GB`) for active downloads and clean total size for completed/seeding tasks.
2. `src/popup/components/downloadItem/DownloadItem.svelte`: Rendered in the secondary metadata row with monospace tabular nums.
3. Unit tests in `format.test.ts` and Storybook stories.
