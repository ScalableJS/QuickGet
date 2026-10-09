---
type: task
id: BUG-75
status: todo
priority: p2
area: content/feedback
board: bugs
updated: 2026-10-09
audit_order: 2
---

# Render page-feedback messages as text

## Problem and evidence

showFeedback interpolates message and action labels into shadow.innerHTML. A local jsdom probe passed a b element as message and observed an actual B node inside the shadow root. API failure reasons can reach this message; script execution or extension privilege escalation was not demonstrated.

Mimic raised the candidate during the 2026-10-09 static review; Codex checked the actual source and the evidence boundaries recorded above. [The audit](../docs/quality/code-quality-audit.md) owns the review context. No runtime correction is included in this audit.

## Acceptance criteria

- [ ] Keep static template markup but insert dynamic messages and action labels through textContent or equivalent text-only DOM construction.
- [ ] Cover literal markup text and existing dismiss/action behavior; preserve the current theme and expiration policy.
- [ ] Run relevant unit and mock-browser regressions plus typecheck, Svelte, lint and production build; update canonical documentation.
