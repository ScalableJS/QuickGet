---
type: "task"
id: "GAP-8"
status: "rejected"
priority: "p2"
area: "popup/ui"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Rejected"
size: "S"
---

# Safe task removal dialog with optional data cleanup (`clean: 1 | 0`)

**Size:** S · **Area:** popup/ui
**Files:** N/A

**Decision (2026-09-05):** Rejected by product direction. Task removal should remove only the task from Download Station's queue by default. Adding extra confirmation dialogs and disk-cleanup checkboxes clutters the interface for marginal value. File deletion belongs in QTS File Station or storage management.
