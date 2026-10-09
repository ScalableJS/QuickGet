---
type: task
id: BUG-74
status: done
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

- [x] Require explicit supported NAS acceptance; treat malformed/empty success bodies as unconfirmed unless a documented firmware contract and captured evidence justify them.
- [x] Add critical regression cases for HTML, empty and malformed HTTP 200; verify browser fallback is preserved and no cancellation occurs without confirmed NAS acceptance.
- [x] Run relevant unit and mock-browser regressions plus typecheck, Svelte, lint and production build; update canonical documentation.

## Implementation started: 2026-10-09

Terra (Codex CLI, gpt-5.6-terra/high) owns the isolated runtime and regression-test patch. Codex owns source review, integrated checks and acceptance; starting work does not close the card.

## Accepted: 2026-10-09

Terra implemented rejection of unparseable HTTP 200 responses and browser fallback regressions. Codex found a second acceptance loophole: raw HTML containing session-does-not-exist still became an accepted duplicate. The added regression failed before the direct parse-error throw and passes afterward; the worker test also preserves browser cancellation/erase boundaries. Chromium confirms the unconfirmed response leaves the browser download available. No NAS acceptance is inferred from HTTP status or HTML words.

Integrated env/dev verification: 563 unit/fixture tests across 40 files, 60 Chromium mock E2E, typecheck, Svelte (zero errors/warnings), lint and production build passed. [The acceptance record](../docs/quality/code-quality-audit.md#accepted-normalization-2026-10-09) distinguishes runtime evidence from documentation review and hardware evidence.

## Follow-up review: 2026-10-09

Mimic supplied additional structured-duplicate and concurrent monitoring/queued-writer scenarios after the first integrated 563-unit/60-browser run. Codex is reproducing the applicable cases before final acceptance. Prior passing evidence is retained; it does not certify these new interleavings.


## Final corrective acceptance: 2026-10-09

Mimic's final review was checked against the source and controlled regressions. Supported duplicate-code gating rejects structured authentication errors; poll revisions, post-storage writer ownership and serialized alarm creation/removal preserve current monitoring state. Codex's two additional storage-read and alarm-clear regressions failed before correction and pass afterward. Browser alarm bookkeeping failure cannot misreport a successful NAS reply as a connection failure.

Final integrated verification passed 571 unit/fixture tests across 40 files, 60 Chromium mock E2E, typecheck, Svelte (zero errors/warnings), lint and production build. Earlier 563-test evidence remains the first-pass record; this final run covers the corrective patch. Broader feedback policies remain in BUG-71.
