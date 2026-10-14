---
type: "task"
id: "GAP-9"
status: "todo"
priority: "p2"
area: "popup/ui"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Backlog"
size: "M"
---

# Quick speed throttle popover in header (presets: Unlimited, 1, 2, 5 MB/s)

**Size:** M · **Area:** popup/ui
**Files:** `src/popup/features/toolbar/`, `src/api/client.ts` (`Config/Get`, `Config/Set`)

> **Measured on the live NAS, 2026-09-13 (`Config/Get`, read-only):** there is **no single
> download rate**. `bt`, `http` and `ftp` each carry their own `max_down_rate`, and `bt` also has
> `max_up_rate`. All were `0` (unlimited). So a one-button "2 MB/s" has to decide what it throttles
> — BT only, or all three — and that is a product decision this card does not yet make. `Config/Get`
> is verified; **`Config/Set` is not**, and this card cannot be sized until it is. Full dump in
> `docs/qnap-download-station-capabilities.md`.

When the NAS saturates the local network connection, users need an instant way to throttle download/upload
speeds without logging into QTS or navigating through deep settings tabs.

**Design rule:** Do NOT use a continuous slider (sliders have poor keyboard UX and massive ranges).
Use a speedometer icon in the header that opens a compact popover with discrete presets:
- Unlimited (`0`)
- 512 KB/s
- 1 MB/s
- 2 MB/s
- 5 MB/s
- 10 MB/s
- Custom...

**Acceptance criteria:**
- [ ] Speedometer icon in header indicates active limit state (subtle accent dot when throttled).
- [ ] Click opens popover with download and upload limit dropdowns.
- [ ] Network request (`Config/Set`) is sent only upon explicit selection/apply, preventing API hammering.
