---
type: task
id: ENG-16
status: todo
priority: p3
area: popup/downloads
board: engineering
updated: 2026-10-09
---

# Remove the unread duplicate-detection snapshot pipeline

## Outcome

A task query no longer builds hash/name sets that have no production consumer.

## Problem

`downloadsManager.ts` builds and stores a raw-task snapshot on every query. Repository call-site
review found no production callers of `getSnapshot()` or `onSnapshotChange()`; current duplicate
handling is based on NAS responses. The selection state in the same module remains live.

## Acceptance criteria

- [ ] Recheck callers, then remove snapshot construction/storage/listeners and their obsolete tests.
- [ ] Preserve selection access/listeners, task list rendering and overlap/abort protection.
- [ ] Preserve API duplicate handling and upload feedback; do not add fuzzy name deduplication.
- [ ] Run focused unit tests and popup/upload/routing/interception E2E; update canonical task-list documentation through an explicit feature review.

## Evidence

[Duplication review](../docs/system/notification-normalization-audit.md#duplication-and-state-review).
No runtime removal was made during the audit.
