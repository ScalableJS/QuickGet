---
type: task
id: ENG-19
status: todo
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

- [ ] Replace the enriched-error assertion/erased return contract with the smallest accurate exported type or construction; consumers no longer need code-property casts.
- [ ] Make the success predicate reflect exactly what it validates; preserve supported numeric/string-zero NAS responses without claiming unvalidated field types.
- [ ] Review runtime library-inferred any bindings and use unknown or accurate callback parameters where needed; do not add unnecessary runtime validation.
- [ ] Keep legitimate DOM/DTO assertions and as const; tests may keep pragmatic any per the user decision.
- [ ] Run existing API/connection/download regressions, typecheck, Svelte, lint, unit, build and mock E2E; update owning documentation.

## Evidence and scope

[The code-quality audit](../docs/quality/code-quality-audit.md) and [callable inventory](../docs/quality/functions.md) record source-grounded findings and review boundaries. This card is planned work, not an accepted runtime change. Test fixture any is explicitly allowed; no task is created merely to eliminate it.
