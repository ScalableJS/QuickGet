---
type: task
id: ENG-21
status: done
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

- [x] Choose the existing formatter as the owner or extract a minimal pure helper; remove the second size algorithm.
- [x] Compare valid sizes, zero, negative/nonfinite data boundary behavior, unit transitions and precision before changing either caller.
- [x] Keep rate units, 1000 promotion and minimum nonzero rate behavior unchanged.
- [x] Verify task-card and torrent-file labels with existing unit/E2E coverage; update the source registry.

## Evidence and scope

[The code-quality audit](../docs/quality/code-quality-audit.md) and [callable inventory](../docs/quality/functions.md) record source-grounded findings and review boundaries. This paragraph records the initial audit; acceptance evidence is below. Test fixture any is explicitly allowed; no task is created merely to eliminate it.

## Implementation started: 2026-10-09

A second Terra CLI run owns only size-formatting sources/tests; API/content/monitoring ownership stays with the first run. Codex owns acceptance and documentation.

## Accepted: 2026-10-09

TorrentFiles imports the existing formatBytes owner; its 12-line duplicate binary-size loop is removed. Valid sizes, zero, invalid/nonpositive fallback, unit boundaries and precision were compared; the torrent file label is verified in Chromium. Rate formatting is unchanged.

Integrated env/dev verification: 563 unit/fixture tests across 40 files, 60 Chromium mock E2E, typecheck, Svelte (zero errors/warnings), lint and production build passed. [The acceptance record](../docs/quality/code-quality-audit.md#accepted-normalization-2026-10-09) distinguishes runtime evidence from documentation review and hardware evidence.
