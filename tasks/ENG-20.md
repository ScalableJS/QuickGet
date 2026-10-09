---
type: task
id: ENG-20
status: todo
priority: p2
area: engineering/code quality
board: engineering
updated: 2026-10-09
audit_order: 5
---

# Remove repeated content-script send protocol without merging feedback surfaces

## Problem

sendMagnetToWorker and sendLinkToWorker each claim an in-flight URI, announce loading, send a runtime message, release the claim, handle runtime.lastError and restore native navigation. Their failure-message policies already differ. This repeats one dispatch protocol in one browser context, unlike the three legitimate feedback renderers.

## Acceptance criteria

- [ ] Share only the in-flight/runtime-callback/fallback kernel if the resulting code is smaller and clearer; keep magnet/link payload construction explicit.
- [ ] Preserve trusted-click/Shift/automatic interception, duplicate claim behavior and native fallback exactly.
- [ ] Cover duplicate and overlapping sends, synchronous throw, runtime.lastError, rejected reply and success with exactly one NAS request and terminal outcome.
- [ ] Keep page operation-correlation and retained-tab policy evidence distinct under BUG-71; no universal notification service or event bus.
- [ ] Run content unit tests and magnet/file/hotlink browser regressions plus full project gates.

## Evidence and scope

[The code-quality audit](../docs/quality/code-quality-audit.md) and [callable inventory](../docs/quality/functions.md) record source-grounded findings and review boundaries. This card is planned work, not an accepted runtime change. Test fixture any is explicitly allowed; no task is created merely to eliminate it.
