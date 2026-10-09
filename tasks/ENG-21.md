---
type: task
id: ENG-21
status: todo
priority: p3
area: engineering/code quality
board: engineering
updated: 2026-10-09
audit_order: 6
---

# Use one binary file-size formatter for task cards and torrent files

## Problem

downloadItem/format.ts scaleUnit and TorrentFiles.svelte formatSize repeat the B/KB/MB/GB/TB loop, 1024 divisor and decimal precision. The task formatter additionally guards invalid/nonpositive values. formatRate has different rounding and minimum-rate policy and must remain distinct.

## Acceptance criteria

- [ ] Choose the existing formatter as the owner or extract a minimal pure helper; remove the second size algorithm.
- [ ] Compare valid sizes, zero, negative/nonfinite data boundary behavior, unit transitions and precision before changing either caller.
- [ ] Keep rate units, 1000 promotion and minimum nonzero rate behavior unchanged.
- [ ] Verify task-card and torrent-file labels with existing unit/E2E coverage; update the source registry.

## Evidence and scope

[The code-quality audit](../docs/quality/code-quality-audit.md) and [callable inventory](../docs/quality/functions.md) record source-grounded findings and review boundaries. This card is planned work, not an accepted runtime change. Test fixture any is explicitly allowed; no task is created merely to eliminate it.
