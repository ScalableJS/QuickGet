---
type: architecture
status: active
area: interface
updated: 2026-10-09
features: ["feedback"]
---

# Feedback, notifications, and errors

Feedback has three owners: the page content script shows in-page send toasts; the popup status pill announces popup operations; the worker controls browser attention and system notifications. These surfaces serve different contexts and are not interchangeable duplicates. Page-feedback message text and action labels use textContent while the renderer retains its static theme/control template.

| Path | Success | Failure |
|---|---|---|
| Page magnet/ordinary link | In-page terminal feedback | In-page error and native handling fallback |
| Browser torrent transaction | NAS task visible; no success notification | Episode-throttled system notification and attention |
| Context-menu send | No system success notification | Direct system notification |
| Popup local torrent | Success or duplicate status message | Error status message |
| Popup URL batch | Full/partial-success status | Per-batch failure summary |
| Task start/pause/stop | Popup status | One visible operation error; unsupported Pause uses the actual Stop outcome |

Worker failure episodes are session-stored and suppressed for 30 minutes while kind/fingerprint remain unchanged. A new problem, elapsed repeat period, or successful clearing of the episode allows a notification again. A settings problem is different from a tracker rejecting access; classification is part of meaningful feedback.

The status pill and accessible form messages are UI mechanisms, not an activity log. Logger usage belongs to the API/debug boundary, with UI `console.*` prohibited by the code standard. Background console logs remain allowed and can reveal user-selected URLs in extension diagnostics.

## Open consistency work

[BUG-71](../../tasks/BUG-71.md) tracks inconsistent send feedback. Current popup sends already have success messages, so the original absence assertion does not describe the current code. The remaining comparison must focus on the intentionally silent torrent/menu paths and any observed lost response; the audit does not close that defect by assumption.

## Popup ownership and recovery

The existing status renderer separates direct user-operation feedback from polling-owned health.
Polling cannot replace a visible direct message. A successful, current query clears only poll-owned
feedback; an aborted or superseded query does not establish recovery. Repeated identical poll errors
are not rendered again. Dismissing the current poll error silences that episode until recovery or a
changed failure fingerprint; a later different failure can be announced.

Plain `Settings saved` and normal upload confirmations expire after 2.5 seconds. Control
confirmations expire after two seconds. Pending work and errors have no blanket timeout. Persistent
messages have a themed native `Dismiss message` button with keyboard focus. Replacing a message
cancels its predecessor's timer. A direct status revision guards late upload results and callback
failures against newer confirmations or validation errors. Downloads additionally scope command
completion to the newest command and invalidate old work on connection replacement/removal.

Accepted uploads, duplicates and partial batches remain identified if a subsequent callback fails;
that failure is reported as a follow-up refresh issue. Accepted browser torrent handoffs likewise
survive failure-episode cleanup rejection. Actual pre-acceptance API failures remain errors.

[[notification-normalization-audit|The audit]] preserves the original reproductions and acceptance
review. [BUG-58](../../tasks/BUG-58.md), [BUG-72](../../tasks/BUG-72.md),
[BUG-73](../../tasks/BUG-73.md), [ENG-17](../../tasks/ENG-17.md) and
[ENG-18](../../tasks/ENG-18.md) own these bounded corrections. This does not establish native
notification delivery or page-toast correlation across every user path.

## Sources and evidence

- [notifier.ts](../../src/background/notifier.ts), [statusPill.ts](../../src/popup/components/statusPill/statusPill.ts), [page feedback](../../src/content/magnet.ts), [logger.ts](../../src/lib/logger.ts).
- Status-pill, logger, magnet, download, menu, and upload unit tests cover relevant call paths. There is no standalone notifier test; notification policy is exercised through its callers and source review.
