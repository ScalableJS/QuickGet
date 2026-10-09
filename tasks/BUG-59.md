---
type: "task"
id: "BUG-59"
status: "done"
priority: "p1"
area: "content/background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Shift-click reports "Could not contact QuickGet" and still opens the browser save flow

**Severity:** high · **Area:** content/background
**Files:** `src/content/magnet.ts`, `src/background/index.ts`, `src/background/menus.ts`,
`manifest.json`

Reported against the real extension on 2026-09-13. With torrent-link interception enabled, an
ordinary click is noticed by QuickGet but can still reach Chrome's save flow. Shift-clicking the
same link produces `Could not contact QuickGet` and also opens the save dialog. The advertised
one-link gesture therefore neither completes the NAS hand-off nor reliably owns the browser
navigation; in the reported state it has no useful outcome.

The intended contract is unambiguous in the current source. `onDocumentClick()` synchronously
calls `preventDefault()` and sends `link:send`; `src/background/index.ts` registers the matching
message branch and routes it through `sendDownloadToStation()`. The observed `runtime.lastError`
means that contract breaks before a response returns. Seeing the native save flow at the same time
also shows that the controlled test-page assumption (one cancellable anchor navigation) does not
cover the real page/browser path. A likely lifecycle case is a tab retaining an orphaned content
script across an extension install/update/reload, but the exact trigger must be captured from the
affected page rather than promoted from hypothesis to root cause.

**Acceptance:** reproduce on the reported tracker and record the full `runtime.lastError`; cover
both a page opened after extension startup and a page already open across extension reload/update;
Shift-click must produce exactly one outcome — a successful NAS task with no browser save dialog
or download — and a failed hand-off must present an explicit, coherent recovery action rather than
an error plus an uncontrolled native flow.

**Resolved 2026-09-13** — Chrome leaves the old content script in tabs that survive an extension
update, but its invalidated extension context can no longer reach the service worker. The update
handler now reinjects the manifest's declarative content scripts into every open HTTP(S) tab.
Reinjection is idempotent: the new script calls the cleanup stored by the previous run before it
attaches a listener. A claimed link also stops page-side click handlers, preventing a tracker from
starting a second download after QuickGet has called `preventDefault()`.

If delivery still fails, the error remains visible and offers explicit `Retry` and `Open locally`
actions; the page is not allowed to choose both outcomes implicitly. Unit coverage verifies the
update reinjection and failed-click recovery. The persistent-tab E2E verifies one successful NAS
request, success feedback, no contact error, and no additional browser `DownloadItem` or local
file after reinjection.

**Contract corrected 2026-09-13** — automatic interception is deliberately conservative until the
full path has earned more trust. An ordinary click now mirrors the link to Download Station while
leaving Chrome's native download/protocol-handler flow untouched; the browser may therefore show
its Save dialog and retain a local copy. Shift-click is the explicit full interception: NAS only,
with no native dialog, new `DownloadItem`, or local file. The downloads listener no longer pauses,
cancels, resumes, erases, or holds the filename of an ordinary `.torrent`. For magnets there is no
portable API to discover or invoke the local protocol handler, so ordinary click simply remains
unprevented while QuickGet sends `AddUrl` in parallel.
