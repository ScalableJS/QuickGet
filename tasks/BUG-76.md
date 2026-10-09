---
type: task
id: BUG-76
status: done
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

- [x] Separate clearing a popup list from publishing confirmed NAS activity; reproduce concurrent connection-change/alarm outcomes before selecting the smallest correction.
- [x] Use controlled pending requests to verify stale success and stale failure cannot overwrite current monitoring state; preserve confirmed idle shutdown and explicit retry behavior.
- [x] Run relevant unit and mock-browser regressions plus typecheck, Svelte, lint and production build; update canonical documentation.

## Implementation started: 2026-10-09

Terra (Codex CLI, gpt-5.6-terra/high) owns the isolated runtime and regression-test patch. Codex owns source review, integrated checks and acceptance; starting work does not close the card.

## Accepted: 2026-10-09

Deferred old-connection success/failure probes failed before the identity check and pass afterward. Codex additionally reproduced alarm removal when settings changed while an old idle badge write was gated; a second identity check after awaited writes prevents old teardown. Popup clearing no longer publishes zero before a new successful query. The accepted scope is these connection-replacement interleavings, not universal concurrency certification.

Integrated env/dev verification: 563 unit/fixture tests across 40 files, 60 Chromium mock E2E, typecheck, Svelte (zero errors/warnings), lint and production build passed. [The acceptance record](../docs/quality/code-quality-audit.md#accepted-normalization-2026-10-09) distinguishes runtime evidence from documentation review and hardware evidence.

## Follow-up review: 2026-10-09

Mimic supplied additional structured-duplicate and concurrent monitoring/queued-writer scenarios after the first integrated 563-unit/60-browser run. Codex is reproducing the applicable cases before final acceptance. Prior passing evidence is retained; it does not certify these new interleavings.


## Final corrective acceptance: 2026-10-09

Mimic's final review was checked against the source and controlled regressions. Supported duplicate-code gating rejects structured authentication errors; poll revisions, post-storage writer ownership and serialized alarm creation/removal preserve current monitoring state. Codex's two additional storage-read and alarm-clear regressions failed before correction and pass afterward. Browser alarm bookkeeping failure cannot misreport a successful NAS reply as a connection failure.

Final integrated verification passed 571 unit/fixture tests across 40 files, 60 Chromium mock E2E, typecheck, Svelte (zero errors/warnings), lint and production build. Earlier 563-test evidence remains the first-pass record; this final run covers the corrective patch. Broader feedback policies remain in BUG-71.
