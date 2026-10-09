---
type: architecture
status: active
area: interface
updated: 2026-10-09
features: ["feedback"]
---

# Feedback, notifications, and errors

Feedback has three owners: the page content script shows in-page send toasts; the popup status pill announces popup operations; the worker controls browser attention and system notifications. These surfaces serve different contexts and are not interchangeable duplicates.

| Path | Success | Failure |
|---|---|---|
| Page magnet/ordinary link | In-page terminal feedback | In-page error and native handling fallback |
| Browser torrent transaction | NAS task visible; no success notification | Episode-throttled system notification and attention |
| Context-menu send | No system success notification | Direct system notification |
| Popup local torrent | Success or duplicate status message | Error status message |
| Popup URL batch | Full/partial-success status | Per-batch failure summary |
| Task start/pause/stop | Popup status | Operation error path |

Worker failure episodes are session-stored and suppressed for 30 minutes while kind/fingerprint remain unchanged. A new problem, elapsed repeat period, or successful clearing of the episode allows a notification again. A settings problem is different from a tracker rejecting access; classification is part of meaningful feedback.

The status pill and accessible form messages are UI mechanisms, not an activity log. Logger usage belongs to the API/debug boundary, with UI `console.*` prohibited by the code standard. Background console logs remain allowed and can reveal user-selected URLs in extension diagnostics.

## Open consistency work

[BUG-71](../../tasks/BUG-71.md) tracks inconsistent send feedback. Current popup sends already have success messages, so the original absence assertion does not describe the current code. The remaining comparison must focus on the intentionally silent torrent/menu paths and any observed lost response; the audit does not close that defect by assumption.

## Sources and evidence

- [notifier.ts](../../src/background/notifier.ts), [statusPill.ts](../../src/popup/components/statusPill/statusPill.ts), [page feedback](../../src/content/magnet.ts), [logger.ts](../../src/lib/logger.ts).
- Status-pill, logger, magnet, download, menu, and upload unit tests cover relevant call paths. There is no standalone notifier test; notification policy is exercised through its callers and source review.
