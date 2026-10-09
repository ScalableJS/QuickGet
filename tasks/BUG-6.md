---
type: "task"
id: "BUG-6"
status: "done"
priority: "p3"
area: "docs"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "low"
---

# Documentation drift

**Severity:** low · **Area:** docs
**Files:** `README.md:8,34`, `docs/feature-roadmap.md:220`

README claims interception is enabled by default (BUG-1 says otherwise). The roadmap still
describes modes as `off/ask/always`, but `INTERCEPT_MODES` has been `["off", "always"]` since
`2ed381c`. If `"ask"` ever shipped, stored values are now invalid and get silently rewritten
to `"off"`, feeding BUG-1. *Unverified: `"ask"` may never have reached users.*

**Done 2026-08-27** — `README.md` now describes the pause/resume behaviour accurately;
`docs/feature-roadmap.md` no longer lists the removed `ask` mode.
