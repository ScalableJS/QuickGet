---
type: "task"
id: "BUG-71"
status: "doing"
priority: "p2"
area: "content/background/popup UX"
board: "bugs"
updated: "2026-10-09"
legacy_status: "In Progress"
severity: "medium"
execution_order: 9
depends_on:
  - BUG-58
  - BUG-72
  - BUG-73
  - ENG-17
---

# Send feedback appears for some torrent/link paths but not for others

**Severity:** medium · **Area:** content/background/popup UX
**Files:** `src/content/magnet.ts`, `src/background/downloads.ts`,
`src/background/magnetHandler.ts`, `src/background/menus.ts`, `src/background/notifier.ts`,
`src/popup/features/upload/torrentUpload.ts`, `src/popup/features/upload/batchUpload.ts`

Reported from real use on 2026-09-15: adding torrents and download links does not produce
consistent feedback — a toast appears on some attempts and not on others. This makes a successful
send hard to distinguish from a missed click and encourages duplicate retries.

The current code already contains an intentional path-dependent split that can explain at least
part of the observation. An ordinary magnet and a Shift-clicked link go through the content script
and show an in-page loading/success/error toast. An ordinary `.torrent` is instead discovered by
`chrome.downloads` and is silent on success. A context-menu send is also silent on success and uses
a system notification only for failure. Popup torrent and batch-URL uploads show an in-progress
status and errors, but a fully successful request returns through the refresh callback without a
terminal success message. This is a confirmed inconsistency in the feedback contract; it does not
yet prove that any individual path intermittently loses a toast.

**Diagnostic acceptance:** build a matrix for ordinary click, Shift-click, context menu, popup
`.torrent` upload, and popup URL upload across `.torrent`, magnet, and ordinary URL sources. For
each applicable cell, record the initiating context, NAS request count/result, local-browser
outcome, toolbar transition, and visible feedback. Repeat on a newly opened tab and a tab retained
across an extension update so a stale content script is not confused with the designed split.

**Decision acceptance:** define one feedback contract by user intent rather than implementation
path. A direct gesture must have one observable terminal outcome for success, duplicate, and
failure; background automation must remain quiet on success; and the solution must not restore the
system-notification spam deliberately removed by UX-10. State explicitly whether the task list or
toolbar is sufficient confirmation for each silent path.

**Fix acceptance:** implement the chosen contract at the narrowest shared boundary and add tests
that prove exactly one NAS request and the expected terminal feedback for every affected path. A
success indication must occur only after Download Station accepts the request, never merely after
dispatch to the service worker.

**Moved to In Progress 2026-09-15** — popup torrent and batch URL uploads now replace their working
status with a terminal success only after the API reports acceptance. Content-click, automatic
download and context-menu paths remain to be measured against the full matrix before this closes.

**Documentation audit 2026-10-09** — current popup torrent and batch URL senders now emit
terminal success status messages. The original assertion that they refresh without success
feedback is historical. The browser-torrent/context-menu success policy remains silent, while
page clicks have terminal toasts. This correction does not close the reported real-use inconsistency.
See [the current feedback matrix](../docs/system/feedback.md).


**2026-10-09 execution priority:** order 9 in the feedback normalization view. The broader cross-surface investigation remains open; finish the confirmed popup and transaction boundaries before changing feedback policy.
