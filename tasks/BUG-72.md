---
type: task
id: BUG-72
status: todo
priority: p2
area: popup/task controls
board: bugs
updated: 2026-10-09
severity: medium
---

# Rejected toolbar task commands lack visible terminal feedback

## Problem

The Start/Stop/Pause feature wrappers await their manager then show success, without catching
rejections. Toolbar dispatch uses `void` without a catch. A rejected command escapes as an
unhandled popup error; Remove and priority actions follow different error paths.

## Evidence

On `e1750e4`, a Chromium diagnostic selected a rendered task, intercepted `Task/Pause` with
`{error: 6}`, and clicked Pause. Playwright captured `pageerror` containing `Pause task failed`;
`#status-message` did not change. Start and Stop share the uncaught structure but were not
individually browser-probed. Existing happy-path E2E still passed.

Sources: [feature wrappers](../src/popup/features/downloads/index.ts) (line 88) and
[toolbar dispatch](../src/popup/features/toolbar/index.ts) (line 32).

## Acceptance criteria

- [ ] Each Start/Stop/Pause failure produces one meaningful visible terminal error, no false success and no unhandled popup rejection.
- [ ] Preserve unsupported-Pause fallback to Stop; distinguish other failures, test rejected Stop, and describe the actual fallback outcome without assuming Pause and Stop are equivalent.
- [ ] Successful commands and retry after failure still work.
- [ ] Unit and browser regressions cover rejection at the actual user-operation boundary.

Implement alongside [ENG-15](ENG-15.md), following [the normalization plan](../docs/system/notification-normalization-audit.md).


**2026-10-09 revalidation on `5dbb6fe`:** all three controls were individually browser-probed.
Each denied Start/Stop/Pause request was observed exactly once; Playwright captured the matching
`pageerror` and no new status feedback. The previous Pause-only limitation is superseded.
The four-test diagnostic suite also confirmed recovery using the popup's own successful response
and a newly rendered `Recovery marker` task, rather than worker-wide request counts.
