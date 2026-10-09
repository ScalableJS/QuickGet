---
type: task
id: BUG-73
status: done
priority: p2
area: background/torrent handoff
board: bugs
updated: 2026-10-09
severity: medium
execution_order: 4
depends_on:
  - ENG-15
---

# Notification bookkeeping can misreport an accepted NAS handoff as failed

## Problem

`downloads.ts` awaits `clearFailureEpisode()` inside the same try/catch as the NAS send.
If session-state removal rejects after NAS acceptance, the catch reports a failed send and
returns false, preventing browser cancellation even though the task was accepted.

## Evidence

Mimic identified this during the 2026-10-09 review. A temporary unit probe stubbed
`sendTorrentUrlToNas()` to resolve acceptance, made `chrome.storage.session.remove()` reject,
and observed no browser cancellation plus a `Download failed` notification. The probe passed
assertions of the existing defect; it did not contact the physical NAS. Possible duplicate
local outcome is established; data loss was not demonstrated.

## Acceptance criteria

- [x] An accepted NAS handoff remains accepted when notification-state cleanup fails.
- [x] Real transport/preflight failures preserve normal browser fallback and meaningful errors.
- [x] Feedback/monitoring failures are isolated from transaction acceptance without hiding transport failures.
- [x] A rejection-injection unit regression fails on the baseline and passes with the fix; interception E2E remains green.

[Audit and plan](../docs/system/notification-normalization-audit.md#secondary-findings-outside-the-reported-popup-problem).


**2026-10-09 revalidation on `5dbb6fe`:** a stronger diagnostic kept the real torrent sender
and API client, served the checked-in sample torrent through MSW, and returned `{error: 0}`
from the mock `AddTorrent` endpoint exactly once. Rejecting only session cleanup still produced
`Download failed` and no browser cancellation. Only monitoring was stubbed; no physical NAS
was contacted. The finding is no longer dependent on stubbing the sender's return value.


**2026-10-09 execution priority:** order 4 in the feedback normalization view. Terra implements the bounded correction with regression evidence; Codex reviews asynchronous ordering, failure semantics and the full project checks before closing the card.

**2026-10-09 assignment:** Terra is implementing this boundary in an isolated feedback-normalization worktree. Acceptance and final status belong to the root reviewer.


**2026-10-09 root acceptance:** Rejected failure-episode cleanup after mocked AddTorrent acceptance no longer changes acceptance or prevents browser cancellation; actual transport failure preserves fallback. Terra implemented the patch; Codex inspected the actual diff, challenged it with reproduced ordering failures and consulted Mimic. 546 unit/fixture tests, 58 Chromium mock E2E, typecheck, Svelte (0 errors/warnings), lint, production and Storybook builds, and 28 deployment unit tests passed in the integrated env/dev working copy. See [accepted evidence](../docs/system/notification-normalization-audit.md#accepted-implementation-and-review). These are mocked/browser results; no fresh physical-NAS or Firefox certification.
