---
type: task
id: ENG-20
status: done
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

- [x] Share only the in-flight/runtime-callback/fallback kernel if the resulting code is smaller and clearer; keep magnet/link payload construction explicit.
- [x] Preserve trusted-click/Shift/automatic interception, duplicate claim behavior and native fallback exactly.
- [x] Cover duplicate and overlapping sends, synchronous throw, runtime.lastError, rejected reply and success with exactly one NAS request and terminal outcome.
- [x] Keep page operation-correlation and retained-tab policy evidence distinct under BUG-71; no universal notification service or event bus.
- [x] Run content unit tests and magnet/file/hotlink browser regressions plus full project gates.

## Evidence and scope

[The code-quality audit](../docs/quality/code-quality-audit.md) and [callable inventory](../docs/quality/functions.md) record source-grounded findings and review boundaries. This paragraph records the initial audit; acceptance evidence is below. Test fixture any is explicitly allowed; no task is created merely to eliminate it.

## Implementation started: 2026-10-09

Terra owns the bounded normalization patch; Codex retains acceptance, documentation and integrated checks. Production fixes from BUG-74 through BUG-76 must be preserved.

## Accepted: 2026-10-09

One private sendToWorker kernel owns claims, callback release, runtime errors and native fallback; explicit wrappers retain payload and rejection/throw wording. Content-focused tests cover duplicate/overlapping sends, success, rejection, lastError, synchronous throw and retry. Magnet/file/hotlink Chromium scenarios pass. The broader page correlation/retained-tab policy remains BUG-71.

Integrated env/dev verification: 563 unit/fixture tests across 40 files, 60 Chromium mock E2E, typecheck, Svelte (zero errors/warnings), lint and production build passed. [The acceptance record](../docs/quality/code-quality-audit.md#accepted-normalization-2026-10-09) distinguishes runtime evidence from documentation review and hardware evidence.
