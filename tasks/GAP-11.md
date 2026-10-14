---
type: "task"
id: "GAP-11"
status: "deferred"
priority: "p2"
area: "popup/ui"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Deferred"
size: "S"
---

# Export `.torrent` file back from NAS via `⋮` menu

**Size:** S · **Area:** popup/ui
**Files:** `src/popup/components/downloadItem/DownloadItem.svelte`, `src/api/client.ts` (`Task/GetTorrentFile`)

QNAP Download Station stores the bencoded `.torrent` file for every task and serves it via
`V4/Task/GetTorrentFile?hash=...&sid=...`. Users occasionally need to export an active or completed torrent file.

**Decision (2026-09-05):** Deferred as low priority / niche demand to avoid complicating the `⋮` action menu.
