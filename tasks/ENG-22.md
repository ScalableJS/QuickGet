---
type: task
id: ENG-22
status: done
priority: p3
area: engineering/code quality
board: engineering
updated: 2026-10-09
audit_order: 7
---

# Reduce repeated typed NAS task-command transport

## Problem

ApiClient.startTask and stopTask are whole-body structural matches after normalizing names/literals. Pause and Remove repeat the same POST/SID/content-type/body-serializer/success/error transport with real semantic differences.

## Acceptance criteria

- [x] Reuse only transport mechanics through the smallest private typed API helper if it improves readability; no untyped arbitrary-endpoint executor.
- [x] Preserve Pause apiUnsupported enrichment and Stop fallback, Remove clean/delete_files options, endpoint/body serializer and single request count.
- [x] Keep concise popup command wrappers inline unless extraction has an independently demonstrated benefit.
- [x] Existing denied/retried and Pause fallback success/denial/transport regressions remain green; compare before/after code size.

## Evidence and scope

[The code-quality audit](../docs/quality/code-quality-audit.md) and [callable inventory](../docs/quality/functions.md) record source-grounded findings and review boundaries. This paragraph records the initial audit; acceptance evidence is below. Test fixture any is explicitly allowed; no task is created merely to eliminate it.

## Implementation started: 2026-10-09

Terra owns the bounded normalization patch; Codex retains acceptance, documentation and integrated checks. Production fixes from BUG-74 through BUG-76 must be preserved.

## Accepted: 2026-10-09

Private sendTaskCommand accepts only four typed command paths and the two generated request shapes. It centralizes transport while wrappers retain Pause enrichment, Remove options and error labels. The methods shrink from 81 to 57 lines plus a 10-line helper (net -14); endpoint/body/request-count and denied/retried/Pause fallback regressions pass. Thin start/stop shape matches remain intentional local outcome wrappers.

Integrated env/dev verification: 563 unit/fixture tests across 40 files, 60 Chromium mock E2E, typecheck, Svelte (zero errors/warnings), lint and production build passed. [The acceptance record](../docs/quality/code-quality-audit.md#accepted-normalization-2026-10-09) distinguishes runtime evidence from documentation review and hardware evidence.
