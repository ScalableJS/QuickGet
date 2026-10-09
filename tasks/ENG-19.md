---
type: task
id: ENG-19
status: done
priority: p2
area: engineering/code quality
board: engineering
updated: 2026-10-09
audit_order: 4
---

# Make runtime API error contracts honest and narrow inferred-any boundaries

## Problem

The runtime has no explicit any or double assertion, but createApiError declares Error while adding code/reason/flags through an assertion. isSuccessResponse accepts error:"0" while its predicate claims BaseResponse.error:number. Compiler inspection additionally finds 11 library-inferred any bindings; these are boundary candidates, not 11 proved defects.

## Acceptance criteria

- [x] Replace the enriched-error assertion/erased return contract with the smallest accurate exported type or construction; consumers no longer need code-property casts.
- [x] Make the success predicate reflect exactly what it validates; preserve supported numeric/string-zero NAS responses without claiming unvalidated field types.
- [x] Review runtime library-inferred any bindings and use unknown or accurate callback parameters where needed; do not add unnecessary runtime validation.
- [x] Keep legitimate DOM/DTO assertions and as const; tests may keep pragmatic any per the user decision.
- [x] Run existing API/connection/download regressions, typecheck, Svelte, lint, unit, build and mock E2E; update owning documentation.

## Evidence and scope

[The code-quality audit](../docs/quality/code-quality-audit.md) and [callable inventory](../docs/quality/functions.md) record source-grounded findings and review boundaries. This paragraph records the initial audit; acceptance evidence is below. Test fixture any is explicitly allowed; no task is created merely to eliminate it.

## Implementation started: 2026-10-09

Terra owns the bounded normalization patch; Codex retains acceptance, documentation and integrated checks. Production fixes from BUG-74 through BUG-76 must be preserved.

## Accepted: 2026-10-09

createApiError has an accurate enriched Error shape constructed with Object.assign; consumers no longer need code casts. isSuccessResponse returns boolean, preserving supported numeric/string-zero without claiming DTO validation. All 11 recorded inferred-any bindings now use unknown or exact callback types; the fresh runtime TS binding scan finds zero. DOM/DTO/typed-array assertions and pragmatic fixture any remain. Codex kept the error type internal and preserved structural coded-error matching in folder validation.

Integrated env/dev verification: 563 unit/fixture tests across 40 files, 60 Chromium mock E2E, typecheck, Svelte (zero errors/warnings), lint and production build passed. [The acceptance record](../docs/quality/code-quality-audit.md#accepted-normalization-2026-10-09) distinguishes runtime evidence from documentation review and hardware evidence.
