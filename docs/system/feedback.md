---
type: architecture
status: active
area: interface
updated: 2026-10-10
features: ["feedback"]
---

# Feedback, notifications, and errors

Feedback has three owners: the page content script shows in-page send toasts; the popup status pill announces popup operations; the worker controls browser attention and system notifications. These surfaces serve different contexts and are not interchangeable duplicates. Page-feedback message text and action labels use textContent while the renderer retains its static theme/control template.

| Path | Success | Failure |
|---|---|---|
| Page magnet/ordinary link | In-page terminal feedback | Known rejection: native fallback; unknown acceptance: persistent check-NAS notice |
| Browser torrent transaction | NAS task visible; no success notification | Episode-throttled system notification and attention |
| Context-menu send | No system success notification | Direct system notification |
| Popup local torrent | Success or duplicate status message | Error status message |
| Popup URL batch | Full/partial-success status | Per-batch failure summary |
| Task start/pause/stop | Popup status | One visible operation error; unsupported Pause uses the actual Stop outcome |

Worker failure episodes are session-stored and suppressed for 30 minutes while kind/fingerprint remain unchanged. Episode decisions, delivery and recovery clearing share a same-worker queue. Suppression is stored only after Chrome accepts notification creation; a rejected promise is logged and permits a later retry. This API-level evidence does not prove operating-system display. A new problem, elapsed repeat period, or successful clearing of the episode allows a notification again. A settings problem is different from a tracker rejecting access; classification is part of meaningful feedback.

The status pill and accessible form messages are UI mechanisms, not an activity log. Logger usage belongs to the API/debug boundary, with UI `console.*` prohibited by the code standard. Background console logs remain allowed and can reveal user-selected URLs in extension diagnostics.

## Intent and page ownership

Page sends and popup operations provide direct feedback. Automatic browser-torrent and context-menu success remain quiet; the accepted task in the list and current toolbar state are their confirmation. No system success notification is restored. A page has one toast owned by the latest gesture; superseded completions cannot replace that message or resurrect it after dismissal. Each send still owns its transport/native result independently of toast ownership.

Gray tracker/send attention and red configuration attention outrank ordinary polling until the popup acknowledges them. Gray acknowledgement clears the notice without returning a false NAS-connection error; red acknowledgement retains the current reason contract and failed browser writes can be retried. Icons still reflect NAS activity independently of attention.

[BUG-71](../../tasks/BUG-71.md) owns the historical report and final bounded browser/API evidence. Current-popup regressions and page/native handling remain separate from proof that an operating system displayed a toast.

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
[ENG-18](../../tasks/ENG-18.md) own these bounded corrections. These historical corrections retain their original evidence limits; the final bounded page/native matrix is recorded below.

## Sources and evidence

- [notifier.ts](../../src/background/notifier.ts), [statusPill.ts](../../src/popup/components/statusPill/statusPill.ts), [page feedback](../../src/content/magnet.ts), [logger.ts](../../src/lib/logger.ts).
- Status-pill, logger, magnet, download, menu, and upload unit tests cover relevant call paths. [Dedicated notifier tests](../../src/background/notifier.test.ts) additionally cover concurrent suppression, rejected creation retry, and ordered recovery clearing.

## Final bounded feedback matrix: 2026-10-10

| Initiation and outcome | Current contract | Named evidence |
|---|---|---|
| Fresh page, direct/nested magnet accepted | One AddUrl request, terminal page success; original browser gesture claimed | Magnet interception E2E |
| Retained page after actual extension reload | One current handler and one accepted NAS send; website remains open | Genuine runtime.reload E2E and DOM-first cleanup tests |
| Ordinary-file capture enabled or Shift override | One NAS send, page result, no browser file on acceptance | File interception E2E |
| Known ordinary-file rejection | Native download preserves the filename; site click handlers stay suppressed | File rejection E2E and content fallback tests |
| Duplicate AddUrl/AddTorrent | Accepted duplicate outcome; no rejection fallback or configuration alarm | Magnet/menu/API tests |
| Overlapping page gestures, dismissal, teardown | Latest gesture owns the single toast; each request keeps its own result/claim | Controlled content callback/timer tests |
| No reply, closed port, uncertain exception, late reply | Persistent uncertainty; no automatic duplicate dispatch/native outcome; current late reply may resolve it | Controlled content messaging tests |
| Automatic browser torrent accepted/rejected | Quiet accepted task; cancellation only after NAS acceptance; browser fallback on rejection | Download/hotlink E2E and transaction tests |
| Context-menu send accepted/duplicate/rejected | Task-list/toolbar confirmation; only failure sends a direct native notification | Menu tests and shared worker transport |
| Popup torrent/batch success/duplicate/partial failure | Explicit status after acceptance, preserves accepted outcome on follow-up failure | Upload tests, popup full-cycle/feedback E2E |
| Popup polling, direct feedback, attention acknowledgement | Polling cannot replace direct feedback; recovery owns only poll errors; gray/red attention survives until acknowledgement | Feedback E2E, status/action tests |
| Simultaneous native failures, Chrome create rejection, recovery | Serialized episode decisions; suppress only accepted creation; rejection remains retryable | Notifier tests |

This matrix identifies the source of each proof rather than treating all cells as browser or hardware tests. Context-menu success deliberately uses task-list/toolbar confirmation. A superseded page gesture does not own a second toast. Native creation acceptance does not certify OS display; long-term tracker and firmware compatibility remain outside this finite acceptance.
