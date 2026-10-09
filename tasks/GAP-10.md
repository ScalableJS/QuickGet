---
type: "task"
id: "GAP-10"
status: "done"
priority: "p2"
area: "popup/ui"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# Task queue priority management in `⋮` menu (Top, Up, Down)

**Size:** S · **Area:** popup/ui
**Files:** `src/popup/components/downloadItem/DownloadItem.svelte`, `src/popup/features/downloads/downloadsManager.ts`, `src/api/client.ts` (`Task/Priority`), `src/api/schema.d.ts`

QNAP Download Station V4 provides `Task/Priority` (`top`, `up`, `down`). Currently, QuickGet does not
expose queue reordering, forcing users to open QTS if a download needs to be prioritized immediately.

**Design rule:** Do NOT add row arrows (`↑ ↓`) directly to each card (causes visual clutter).
Do NOT implement drag-and-drop (API does not support arbitrary indexing; simulating it triggers racing requests).
Place actions inside the card's `⋮` overflow menu:
- *Move to top* (`priority: "top"`)
- *Move up* (`priority: "up"`)
- *Move down* (`priority: "down"`)

**Acceptance criteria:**
- [x] Priority actions placed in card's `⋮` menu.
- [x] Disabled state when task is already at top or bottom, or when task is finished/stopped.
- [x] Immediate UI refresh on completion.
