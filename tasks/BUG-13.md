---
type: "task"
id: "BUG-13"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Toolbar repaint failure aborts the NAS hand-off

**Severity:** high · **Area:** background
**Files:** `src/background/actions.ts`, `src/background/downloads.test.ts`

`markInterceptionStarted()` awaits `chrome.action.setIcon()` in the critical hand-off path.
If Chrome rejects that cosmetic API call, the torrent is never sent to the NAS. A toolbar
rendering failure must be observable in diagnostics but must never control the transfer.

**Reproduced 2026-08-28** — regression test forces `setIcon()` to reject; `AddTorrent` receives
zero requests and the browser download is not cancelled.

**Done 2026-08-28** — toolbar API failures are caught at the visual boundary. They no longer
abort a hand-off or turn a valid NAS snapshot into a monitoring failure; failed icon state is
not cached as applied, so a later transition retries it.
