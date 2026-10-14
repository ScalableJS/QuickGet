---
type: task
id: ENG-15
status: done
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

- [x] Implement the critical scenario matrix in [the audit](../docs/system/notification-normalization-audit.md), with baseline failures for reproduced defects, matching fixes, and baseline-passing preservation tests.
- [x] Preserve existing Pause-to-Stop fallback, NAS acceptance ordering and duplicate semantics.
- [x] Assert no unhandled popup rejection and one meaningful terminal outcome for direct actions.
- [x] Verify repeated polling cannot overwrite Save/Test/Upload and recovery clears only its owner.
- [x] Add new browser specs to default and headed mock commands; existing suites remain green.
- [x] Record coverage scope honestly; no score-inflating exclusions or arbitrary thresholds.

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

**2026-10-09 acceptance review:** the initial draft added 14 baseline-failing regression cases, five passing popup browser scenarios and real-renderer callback probes. Root and Mimic review require truthful fallback outcomes, connection generation and removal reconciliation before acceptance. Root additionally reproduced cross-writer late callback overwrite, stale polling dismissal after an error-kind change, and an orphaned removal marker; these are review blockers, not completed outcomes.


**2026-10-09 root acceptance:** Permanent regressions cover the targeted popup acceptance matrix; the initial 14 baseline failures and later review failures became green. Default/headed mock spec lists match and entrypoint/component coverage limitations remain explicit. Terra implemented the patch; Codex inspected the actual diff, challenged it with reproduced ordering failures and consulted Mimic. 546 unit/fixture tests, 58 Chromium mock E2E, typecheck, Svelte (0 errors/warnings), lint, production and Storybook builds, and 28 deployment unit tests passed in the integrated env/dev working copy. See [accepted evidence](../docs/system/notification-normalization-audit.md#accepted-implementation-and-review). These are mocked/browser results; no fresh physical-NAS or Firefox certification.
