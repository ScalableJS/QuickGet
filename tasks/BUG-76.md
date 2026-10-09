---
type: task
id: BUG-76
status: todo
priority: p2
area: background/monitoring
board: bugs
updated: 2026-10-09
audit_order: 3
---

# Keep monitoring snapshots tied to confirmed connection results

## Problem and evidence

Source review found connectionChanged sends summarizeProgress([]) before the new NAS query finishes. Background pollStatus applies results after awaiting queryTasks without rechecking connection identity; an old request can potentially publish a stale snapshot. The empty publication is source-confirmed; the out-of-order background race still needs controlled reproduction.

Mimic raised the candidate during the 2026-10-09 static review; Codex checked the actual source and the evidence boundaries recorded above. [The audit](../docs/quality/code-quality-audit.md) owns the review context. No runtime correction is included in this audit.

## Acceptance criteria

- [ ] Separate clearing a popup list from publishing confirmed NAS activity; reproduce concurrent connection-change/alarm outcomes before selecting the smallest correction.
- [ ] Use controlled pending requests to verify stale success and stale failure cannot overwrite current monitoring state; preserve confirmed idle shutdown and explicit retry behavior.
- [ ] Run relevant unit and mock-browser regressions plus typecheck, Svelte, lint and production build; update canonical documentation.
