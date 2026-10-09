---
type: task
id: ENG-22
status: todo
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

- [ ] Reuse only transport mechanics through the smallest private typed API helper if it improves readability; no untyped arbitrary-endpoint executor.
- [ ] Preserve Pause apiUnsupported enrichment and Stop fallback, Remove clean/delete_files options, endpoint/body serializer and single request count.
- [ ] Keep concise popup command wrappers inline unless extraction has an independently demonstrated benefit.
- [ ] Existing denied/retried and Pause fallback success/denial/transport regressions remain green; compare before/after code size.

## Evidence and scope

[The code-quality audit](../docs/quality/code-quality-audit.md) and [callable inventory](../docs/quality/functions.md) record source-grounded findings and review boundaries. This card is planned work, not an accepted runtime change. Test fixture any is explicitly allowed; no task is created merely to eliminate it.
