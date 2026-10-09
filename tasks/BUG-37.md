---
type: "task"
id: "BUG-37"
status: "done"
priority: "p2"
area: "popup/UX"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Task failure codes (`error`) from QNAP are ignored instead of displaying failure reason

**Severity:** medium · **Area:** popup/UX
**Files:** `src/lib/tasks.ts`, `src/popup/components/downloadItem/format.ts`,
`src/popup/components/downloadItem/DownloadItem.svelte`

When a task fails (QNAP state `2` / `error`), Download Station provides an integer `error` code
(e.g., duplicate hash, out of disk space, network connection timeout, invalid torrent metadata,
target path permission error). QuickGet displays only a generic red "Error" badge without detail.

**Resolved 2026-09-05** —
1. `src/lib/tasks.ts`: Extracted `errorCode` from QNAP task payload in `normalizeQnap`.
2. `src/popup/components/downloadItem/format.ts`: Created `QNAP_ERROR_MESSAGES` mapping known QNAP error integers (20488 disk full, 8196 duplicate torrent, 4096 missing destination folder, 12288-12290 network/DNS errors).
3. `src/popup/components/downloadItem/DownloadItem.svelte`: Replaced generic error with human-readable error explanation in coral text and card styling.
4. Unit tests in `format.test.ts` and Storybook stories (`ErrorDiskFull`, `ErrorDuplicate`, `ErrorFolderNotFound`).
