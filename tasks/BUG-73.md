---
type: task
id: BUG-73
status: todo
priority: p2
area: background/torrent handoff
board: bugs
updated: 2026-10-09
severity: medium
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

- [ ] An accepted NAS handoff remains accepted when notification-state cleanup fails.
- [ ] Real transport/preflight failures preserve normal browser fallback and meaningful errors.
- [ ] Feedback/monitoring failures are isolated from transaction acceptance without hiding transport failures.
- [ ] A rejection-injection unit regression fails on the baseline and passes with the fix; interception E2E remains green.

[Audit and plan](../docs/system/notification-normalization-audit.md#secondary-findings-outside-the-reported-popup-problem).


**2026-10-09 revalidation on `5dbb6fe`:** a stronger diagnostic kept the real torrent sender
and API client, served the checked-in sample torrent through MSW, and returned `{error: 0}`
from the mock `AddTorrent` endpoint exactly once. Rejecting only session cleanup still produced
`Download failed` and no browser cancellation. Only monitoring was stubbed; no physical NAS
was contacted. The finding is no longer dependent on stubbing the sender's return value.
