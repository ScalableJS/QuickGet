---
type: "task"
id: "GAP-13"
status: "todo"
priority: "p2"
area: "settings/api"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Backlog"
size: "S"
---

# Default seeding time and share ratio limits in Settings

**Size:** S · **Area:** settings/api
**Files:** `src/popup/features/settings/Settings.svelte`, `src/lib/config.ts`, `src/api/client.ts`

Download Station configures seeding stopping conditions via `bt.share_time` (minutes) and
`bt.share_ratio` (ratio limit). Currently, users must configure these directly on the NAS.

> **Confirmed live, 2026-09-13:** `Config/Get` returns `bt.share_ratio: 1.5` and
> `bt.share_time: 30`, so both fields and their current defaults are real. `Config/Set` remains
> **unverified** — no card in this group can be sized until someone writes to it once.

**Acceptance criteria:**
- [ ] Settings inputs for default seeding duration (minutes, `-1` for unlimited) and share ratio limit.
- [ ] Reads current values via `Config/Get` and saves via `Config/Set`.
