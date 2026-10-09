---
type: task
id: ENG-17
status: todo
priority: p3
area: popup/upload feedback
board: engineering
updated: 2026-10-09
execution_order: 5
depends_on:
  - ENG-15
  - BUG-58
  - BUG-72
---

# Keep accepted upload results distinct from later callback failures

## Outcome

Accepted, duplicate and partially accepted NAS work remains identifiable when a following
UI/refresh callback fails; a useful callback error has its own context.

## Evidence and limits

Mimic's recheck identified that `torrentUpload.ts` and `batchUpload.ts` call success/duplicate
callbacks inside the same try/catch as the request. Three temporary unit probes used mocked
API outcomes and deliberately throwing callbacks. The real status renderer replaced full
acceptance, duplicate or partial acceptance with `Error: post-acceptance callback failed`.
The corrected probe suite passed after adding the missing cache-invalidation export to its
API mock; the initial setup failure is not product evidence.

No built-in callback was observed throwing during normal browser use, no physical NAS was
contacted, and this is not a proven cause of the user's popup symptom. It is a fault-injection
boundary to cover during normalization, after confirmed BUG-58/BUG-72 fixes.

## Acceptance criteria

- [ ] Full, duplicate and partial outcomes remain accurate if a subsequent callback throws.
- [ ] Preserve real transport failure feedback and avoid duplicate announcements.
- [ ] Represent a relevant post-acceptance UI/refresh failure separately from NAS acceptance.
- [ ] Add controlled callback-injection unit tests and browser checks for normal upload/refresh interleaving through ENG-15.

[Revalidation and plan](../docs/system/notification-normalization-audit.md).


**2026-10-09 execution priority:** order 5 in the feedback normalization view. Terra implements the bounded correction with regression evidence; Codex reviews asynchronous ordering, failure semantics and the full project checks before closing the card.
