---
type: task
id: BUG-74
status: todo
priority: p1
area: API/torrent handoff
board: bugs
updated: 2026-10-09
audit_order: 1
---

# Reject unconfirmed torrent acceptance on malformed HTTP success

## Problem and evidence

ApiClient.addTorrent synthesizes error:0 when JSON parsing fails and HTTP status is successful. A local MSW probe returning HTTP 200 with an HTML login page resolved added:true. The worker cancellation path trusts a resolved handoff; actual browser cancellation under this malformed-response case was not reproduced.

Mimic raised the candidate during the 2026-10-09 static review; Codex checked the actual source and the evidence boundaries recorded above. [The audit](../docs/quality/code-quality-audit.md) owns the review context. No runtime correction is included in this audit.

## Acceptance criteria

- [ ] Require explicit supported NAS acceptance; treat malformed/empty success bodies as unconfirmed unless a documented firmware contract and captured evidence justify them.
- [ ] Add critical regression cases for HTML, empty and malformed HTTP 200; verify browser fallback is preserved and no cancellation occurs without confirmed NAS acceptance.
- [ ] Run relevant unit and mock-browser regressions plus typecheck, Svelte, lint and production build; update canonical documentation.
