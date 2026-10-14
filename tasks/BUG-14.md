---
type: "task"
id: "BUG-14"
status: "done"
priority: "p2"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Context-menu sends omit working and failure toolbar states

**Severity:** medium · **Area:** background
**Files:** `src/background/menus.ts`, `src/background/menus.test.ts`

The context-menu path starts the same AddUrl/AddTorrent process but only requests a NAS poll
after success. While the request is in flight the toolbar remains idle, and on failure it
shows only a transient notification without the persistent red action state.

**Reproduced 2026-08-28** — gated AddUrl test observes zero active-icon writes before the NAS
response; rejected AddUrl leaves no `qg:toolbarState` failure marker.

**Done 2026-08-28** — both AddUrl and fetched-torrent context-menu sends now publish the active
state before network completion, clear only an older failure on success, and persist red on
failure. Both new regressions pass.
