---
type: "task"
id: "GAP-12"
status: "todo"
priority: "p2"
area: "settings/api"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Backlog"
size: "S"
---

# Private tracker client emulation (`peer_mode`: Transmission, Deluge)

**Size:** S · **Area:** settings/api
**Files:** `src/popup/features/settings/Settings.svelte`, `src/lib/config.ts`, `src/api/client.ts`

Private trackers (Rutracker, Gazelle, etc.) frequently blacklist Download Station's default `libtorrent`
peer ID. QNAP Download Station V4 natively includes client emulation in `Config.Set`:

> **Confirmed live, 2026-09-13:** `Config/Get` on QTS5 returns `bt.peer_mode: 1`,
> `bt.peer_id: "LT"`, `bt.peer_agent: "libtorrent/1.2.11"`, `bt.peer_version: "1.2.11"` — the
> fields this card assumes really are there, with the default `libtorrent` identity this card
> exists to change. `Config/Set` remains **unverified**.
- `0`: Libtorrent default
- `1`: Deluge 1.3.12 (`DE`)
- `2`: Transmission 2.94 (`TR`)
- `3`: uTorrent Mac 1.8.7 (`UM`)

**Design rule:** Lives strictly in `Settings → Advanced`, never in the popup list.

**Acceptance criteria:**
- [ ] Dropdown in Settings allowing selection of client emulation mode.
- [ ] Applied to NAS via `Config/Set` (`bt.peer_mode`).
