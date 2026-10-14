---
type: task
id: ENG-12
status: done
priority: p2
area: documentation
board: engineering
updated: 2026-10-09
---

# Establish an English Obsidian knowledge base with feature coverage

## Outcome

Current behavior has canonical pages linked to owning source/evidence files. Review drift,
new unclassified sources, broken navigation and non-English prose fail maintained checks.
Confirmed unused candidates and different active paths are recorded without speculative deletion.

## Acceptance criteria

- [x] Audit maintained prose/comments, translate historical quotes, preserve Unicode input fixtures.
- [x] Describe current behavior with English Obsidian pages and a feature/source/evidence registry.
- [x] Verify coverage checks fail on drift, denominator hiding, missing links and staged mismatch.
- [x] Record unused/duplicate candidates and behavioral gaps with concrete source evidence.
- [x] Run repository quality gates and synchronize the finished work to origin/env/dev.

## Evidence

The [documentation home](../docs/index.md), [registry](../docs/features.json),
[coverage report](../docs/system/coverage.md), and [feature review](../docs/system/feature-review.md)
own the durable result. This task does not certify a fresh real-NAS or Firefox runtime run.

**Completed 2026-10-09** — 20 registered features, 148 independently discovered source files,
zero unclassified sources, and explicit single-feature reviews. The language audit retains
12 intentional Unicode input literals; maintained prose and descriptions are English.

Validation: typecheck, Svelte check, lint and production build passed; 513 unit tests,
45 mock E2E, 28 deployment tests and 11 documentation self-tests passed. Rulesync generation
is current. The prepared Git index is checked before committing; publication targets origin/env/dev.

Current documentation corrects obsolete credential-encryption, monitoring, Firefox-minimum
and toolbar claims. Existing cleanup work remains ENG-9/ENG-10; batch destination policy and
Firefox runtime verification are ENG-13/ENG-14. No product functionality was removed.
