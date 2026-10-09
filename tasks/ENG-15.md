---
type: task
id: ENG-15
status: doing
priority: p2
area: popup/testing
board: engineering
updated: 2026-10-09
execution_order: 1
---

# Establish popup feedback regression gates before normalization

## Outcome

Notification changes are reviewed against behavior-level unit and browser regressions,
including recovery, competing writers, terminal failures and stale timers.

## Problem

The 2026-10-09 audit passed 513 tests and 45 mock E2E while separately reproducing a stale
poll error and an unhandled toolbar Pause failure. V8's configured subset excludes popup
entrypoint wiring and Svelte components. Existing green tests are insufficient for this work.

## Acceptance criteria

- [ ] Implement the critical scenario matrix in [the audit](../docs/system/notification-normalization-audit.md), with baseline failures for reproduced defects, matching fixes, and baseline-passing preservation tests.
- [ ] Preserve existing Pause-to-Stop fallback, NAS acceptance ordering and duplicate semantics.
- [ ] Assert no unhandled popup rejection and one meaningful terminal outcome for direct actions.
- [ ] Verify repeated polling cannot overwrite Save/Test/Upload and recovery clears only its owner.
- [ ] Add new browser specs to default and headed mock commands; existing suites remain green.
- [ ] Record coverage scope honestly; no score-inflating exclusions or arbitrary thresholds.

## Evidence

[Audit, measured coverage and phased plan](../docs/system/notification-normalization-audit.md).
The temporary diagnostic probes demonstrated defects; passing assertions of defective behavior
are not the regression acceptance tests required by this task.


**2026-10-09 revalidation:** full baseline remains 513 tests / 45 mock E2E. Four strengthened
Chromium diagnostics independently reproduce popup recovery and rejected Start/Stop/Pause.
Two timer-preservation probes pass on the baseline: existing timer replacement is correct.
Retain that behavior and test async ownership; do not add redundant timer guards merely to
increase the number of fixes. See the audit's revalidation section for exact scope and limits.


**Recheck acceptance additions:** deferred query results must not overwrite a replacement query
or a changed NAS configuration; overlapping user commands need explicit precedence. Cover both
Stop success and failure after unsupported Pause and report the actual fallback outcome. Separate
an accepted Remove from a failing refresh. [ENG-17](ENG-17.md) adds callback-fault cases for
accepted/duplicate torrent uploads and partial batches; existing built-in callbacks were not
observed throwing in production.


**2026-10-09 execution priority:** order 1 in the feedback normalization view. Terra implements regression gates alongside each bounded fix; Codex owns review and acceptance. Reproduced defects require a recorded failing baseline before their tests can be accepted.
