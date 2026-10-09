---
type: "task"
id: "GAP-7"
status: "done"
priority: "p2"
area: "popup/ui"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# Global NAS transfer rates in popup header (`↓ 24.8 MB/s ↑ 3.1 MB/s`)

**Size:** S · **Area:** popup/ui
**Files:** `src/popup/features/toolbar/Toolbar.svelte`, `src/popup/features/toolbar/toolbarView.svelte.ts`, `src/popup/features/downloads/downloadsUI.ts`, `src/api/client.ts` (`getStatus`)

When opening the popup, users currently see individual task speeds, but have no quick visibility
into the total bandwidth consumed by the NAS across all active downloads and background uploads.

**Competitor precedent:** Transmission Easy Client and Synology Download Station show combined
download/upload rates directly in the header (`↓ 12.4 MB/s  ↑ 1.2 MB/s`).

**Acceptance criteria:**
- [x] Header displays total `down_rate` and `up_rate` while tasks are active with semantic arrow colors.
- [x] Displays compact `Idle` text when all rates are 0 B/s.
- [x] Polled only while popup UI is open; does not wake background worker unnecessarily.
