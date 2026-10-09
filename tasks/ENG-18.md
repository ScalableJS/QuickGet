---
type: task
id: ENG-18
status: done
priority: p3
area: popup/feedback lifecycle
board: engineering
updated: 2026-10-09
execution_order: 5
depends_on:
  - ENG-15
  - BUG-58
  - BUG-72
---

# Bound confirmation lifetime and allow persistent popup feedback to be dismissed

## Problem

The audit reproduced indefinite default status lifetime. Settings saved without a connection
check has no TTL; actionable errors also have no dismissal control. This is separate from
poll recovery and rejected task commands, and matches the reported popup messages that remain.

## Acceptance criteria

- [x] A completed Settings-saved confirmation expires consistently with existing short success feedback.
- [x] Working Save/Test/Upload messages remain visible while the operation is pending.
- [x] Persistent actionable errors have an accessible, keyboard-operable dismissal control.
- [x] Dismissing a poll error does not cause the same unresolved episode to reannounce every two seconds; recovery permits a later genuinely new failure episode.
- [x] Old timers do not clear newer timed or persistent messages; owner-scoped recovery does not clear another operation.
- [x] Unit tests use the real status DOM and fake timers; browser checks prove confirmation expiry and dismissal.

## Assignment and acceptance

**2026-10-09:** Terra implements the bounded lifecycle change after the confirmed ownership and
command fixes. Codex reviews timer/recovery/dismiss ordering and accepts against the integrated
test gates. No global TTL applies to in-progress operations and no notification framework is needed.

[Audit](../docs/system/notification-normalization-audit.md#p3-transient-and-persistent-messages-have-inconsistent-policy).


**2026-10-09 root acceptance:** Plain Settings-saved confirmation expires after 2500 ms; pending operations have no blanket expiry. Themed native keyboard dismissal silences one poll episode and resets on recovery, changed failure or connection change without clearing direct feedback. Terra implemented the patch; Codex inspected the actual diff, challenged it with reproduced ordering failures and consulted Mimic. 546 unit/fixture tests, 58 Chromium mock E2E, typecheck, Svelte (0 errors/warnings), lint, production and Storybook builds, and 28 deployment unit tests passed in the integrated env/dev working copy. See [accepted evidence](../docs/system/notification-normalization-audit.md#accepted-implementation-and-review). These are mocked/browser results; no fresh physical-NAS or Firefox certification.
