---
type: "task"
id: "BUG-31"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Successful torrent hand-offs retain a Chrome DownloadItem after restart

**Severity:** high · **Area:** background
**Files:** `src/background/downloads.ts`, `src/background/downloads.test.ts`,
`tests/e2e/download-interception.spec.ts`

After Download Station accepts an intercepted `.torrent`, the extension cancels the matching
Chrome transfer but intentionally leaves its `DownloadItem` in Chrome's history. A real Chromium
profile test closes and reopens the browser, then receives that same record again (`id: 1`,
`state: "complete"`, original `.torrent` URL). The current run does **not** make a second
`AddTorrent` request, so persistence is proven but automatic NAS replay is not yet reproduced.

The source code explicitly chose this behaviour: `cancelBrowserDownload()` says it keeps a
cancelled download in Chrome's list to offer the user Retry. The E2E result shows the overlooked
fast-download case: the source can already be `complete` before cancel, yet its history entry is
still retained across a browser restart.

**Decision taken:** do not mutate the browser download before `AddTorrent` succeeds; after
success, erase its terminal `DownloadItem`.
Chrome documents that `chrome.downloads.erase({ id })` removes history metadata, not a local file.
A failed hand-off or a transfer resumed because cancellation failed must remain untouched for
manual recovery.

**Evidence under test 2026-08-30** — the old implementation deliberately keeps the completed or
cancelled `DownloadItem` after NAS acceptance. The new unit and real-Chromium E2E regressions
assert that this entry must be absent. Before the fix, the E2E assertion reproduced the retained
entry; the evidence review then authorized the remediation described below.

**Implemented 2026-08-30** — after explicit approval, a successful hand-off erases its terminal
Chrome `DownloadItem`. Failure paths still retain or resume the browser download.
`downloads.erase()` removes Chrome history metadata only and does not delete a local file.
No history-wide migration or startup cleanup runs: QuickGet touches only the record belonging
to the current successful user action.

**Verified 2026-08-30** — unit tests prove `pause → AddTorrent success → cancel → erase` ordering
and retain history on both failure/recovery paths. A real persistent Chromium profile confirms
the successful item is absent after a full close/reopen and that no second `AddTorrent` occurs.
