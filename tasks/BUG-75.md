---
type: task
id: BUG-75
status: done
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

- [x] Keep static template markup but insert dynamic messages and action labels through textContent or equivalent text-only DOM construction.
- [x] Cover literal markup text and existing dismiss/action behavior; preserve the current theme and expiration policy.
- [x] Run relevant unit and mock-browser regressions plus typecheck, Svelte, lint and production build; update canonical documentation.

## Implementation started: 2026-10-09

Terra (Codex CLI, gpt-5.6-terra/high) owns the isolated runtime and regression-test patch. Codex owns source review, integrated checks and acceptance; starting work does not close the card.

## Accepted: 2026-10-09

Terra replaced only dynamic message/action-label insertion with textContent. Codex reviewed the static template, theme, dismiss/action handlers and timers. Literal-markup tests and existing page browser scenarios pass; no script-execution claim is made.

Integrated env/dev verification: 563 unit/fixture tests across 40 files, 60 Chromium mock E2E, typecheck, Svelte (zero errors/warnings), lint and production build passed. [The acceptance record](../docs/quality/code-quality-audit.md#accepted-normalization-2026-10-09) distinguishes runtime evidence from documentation review and hardware evidence.
