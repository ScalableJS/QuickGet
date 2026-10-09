---
type: architecture
status: active
area: popup
updated: 2026-10-09
features: ["task-list", "task-operations"]
---

# Task list, actions, and torrent files

## Live task list

The popup queries Download Station and normalizes its response through the QNAP client. The open popup refreshes every two seconds. Overlapping list requests are avoided; active requests are aborted when closing. Selection is shared by the toolbar and task list; Svelte runes render the current query result. The unread parallel duplicate-detection snapshot pipeline has been removed. Aborted or superseded queries cannot update rows, feedback or badge counts. Saving or removing a connection invalidates pending work, clears selection and former rows, and starts a query for the current configuration.

Task cards show progress, downloaded/total bytes, rates, status, errors, and relevant torrent details. Seeding remains visible in the in-progress view; its share ratio, seeding goal, and upload data differ from download progress. Seeds/peers are shown when relevant. Search/status filters are local view state. The header totals come from the current task snapshot. An overridden destination is shown when it differs from the configured Target folder.

## Task operations

The selected task can start, pause, stop, or be removed. Removing the NAS files is a separate destructive action with confirmation. Removal clears selection and, when still current, aborts an older query and starts a fresh reconciliation query. The removal marker has its own owner, so an unrelated newer Start cannot leave it stuck and an older removal cannot clear a newer marker. Accepted removal followed by a failed refresh is reported separately from a failed deletion. Start, Stop, Pause and Remove catch their failures at the popup operation boundary; older command completions cannot replace a newer command result. Unsupported Pause falls back to Stop, and both successful and rejected fallbacks are labeled Stop, including transport rejection. Queue actions (`Move to top`, `Up`, `Down`) use `SetTaskPriority`; optimistic view changes are not evidence that the NAS applied them, so tests re-query the owning layer.

A torrent card can expand a file list from `GetFile` and set per-file priorities through `SetFile`. The API sends one file per call. This is download-selection management inside an existing torrent, not editing a local torrent descriptor.

No post-delete undo is implemented. NAS deletion, queue order, and file priority are separate API operations, even if the controls share a card. There is no local activity-history product or persistent copy of NAS task data owned by this popup.

## Sources and evidence

- [Downloads feature](../../src/popup/features/downloads/index.ts), [manager](../../src/popup/features/downloads/downloadsManager.ts), [list](../../src/popup/features/downloads/DownloadsList.svelte), [card](../../src/popup/components/downloadItem/DownloadItem.svelte).
- [Task semantics](../../src/lib/tasks.ts), [formatters](../../src/popup/components/downloadItem/format.ts), [TorrentFiles.svelte](../../src/popup/features/torrentFiles/TorrentFiles.svelte), [toolbar actions](../../src/popup/features/toolbar/index.ts).
- [Feedback normalization E2E](../../tests/e2e/feedback-normalization.spec.ts) and [feature orchestration unit tests](../../src/popup/features/downloads/index.test.ts) cover rejection, recovery, stale connection work and removal ordering.
- [Popup E2E](../../tests/e2e/popup.full-cycle.spec.ts), [torrent-file E2E](../../tests/e2e/torrent-files.spec.ts), and manager/state/formatter/filter unit tests.

Documentation is reviewed against these paths. Mock task data is not a field measurement of every QNAP task state.
