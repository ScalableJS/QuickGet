---
type: task
id: ENG-16
status: done
priority: p3
area: popup/downloads
board: engineering
updated: 2026-10-09
execution_order: 7
depends_on:
  - ENG-15
  - BUG-58
  - BUG-72
---

# Remove the unread duplicate-detection snapshot pipeline

## Outcome

A task query no longer builds hash/name sets that have no production consumer.

## Problem

`downloadsManager.ts` builds and stores a raw-task snapshot on every query. Repository call-site
review found no production callers of `getSnapshot()` or `onSnapshotChange()`; current duplicate
handling is based on NAS responses. The selection state in the same module remains live.

## Acceptance criteria

- [x] Recheck callers, then remove snapshot construction/storage/listeners and their obsolete tests.
- [x] Preserve selection access/listeners, task list rendering and overlap/abort protection.
- [x] Preserve API duplicate handling and upload feedback; do not add fuzzy name deduplication.
- [x] Run focused unit tests and popup/upload/routing/interception E2E; update canonical task-list documentation through an explicit feature review.

## Evidence

[Duplication review](../docs/system/notification-normalization-audit.md#duplication-and-state-review).
No runtime removal was made during the audit.


**2026-10-09 execution priority:** order 6 in the feedback normalization view. Cleanup follows verified behavioral fixes. Recheck production consumers before removing code; preserve live neighboring helpers and API duplicate semantics.

**2026-10-09 draft review:** Terra removed the unread snapshot producer, storage and subscriptions after rechecking callers. Live selection and query guards remain. Root acceptance waits for the integrated feedback corrections and full gates; no code removal is certified by static search alone.


**2026-10-09 root acceptance:** Removed unread raw-task snapshot construction/state/listeners and obsolete snapshot assertions; live selection, query protection and NAS duplicate semantics remain. Terra implemented the patch; Codex inspected the actual diff, challenged it with reproduced ordering failures and consulted Mimic. 546 unit/fixture tests, 58 Chromium mock E2E, typecheck, Svelte (0 errors/warnings), lint, production and Storybook builds, and 28 deployment unit tests passed in the integrated env/dev working copy. See [accepted evidence](../docs/system/notification-normalization-audit.md#accepted-implementation-and-review). These are mocked/browser results; no fresh physical-NAS or Firefox certification.
