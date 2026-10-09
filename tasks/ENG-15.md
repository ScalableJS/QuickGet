---
type: task
id: ENG-15
status: todo
priority: p2
area: popup/testing
board: engineering
updated: 2026-10-09
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

- [ ] Implement the critical scenario matrix in [the audit](../docs/system/notification-normalization-audit.md), with baseline failures and matching fixes.
- [ ] Preserve existing Pause-to-Stop fallback, NAS acceptance ordering and duplicate semantics.
- [ ] Assert no unhandled popup rejection and one meaningful terminal outcome for direct actions.
- [ ] Verify repeated polling cannot overwrite Save/Test/Upload and recovery clears only its owner.
- [ ] Add new browser specs to default and headed mock commands; existing suites remain green.
- [ ] Record coverage scope honestly; no score-inflating exclusions or arbitrary thresholds.

## Evidence

[Audit, measured coverage and phased plan](../docs/system/notification-normalization-audit.md).
The temporary diagnostic probes demonstrated defects; passing assertions of defective behavior
are not the regression acceptance tests required by this task.
