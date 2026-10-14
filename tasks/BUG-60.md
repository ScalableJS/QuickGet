---
type: "task"
id: "BUG-60"
status: "done"
priority: "p1"
area: "testing"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Shift-click E2E passes without proving the real browser outcome or extension-lifecycle failure

**Severity:** high · **Area:** testing
**Files:** `tests/e2e/routing-matrix.spec.ts`, `tests/e2e/fixtures/test-stand/index.html`,
`tests/e2e/support/extension.ts`, `src/content/magnet.test.ts`

The regression named `Shift-click sends a link even with every automatic mode switched off`
passes while BUG-59 is observable in the real extension. Re-run on 2026-09-13 after a clean build:
`1 passed (4.2s)`. It proves only that a freshly opened synthetic page with a direct `.torrent`
`href` eventually causes the mock NAS to receive `AddTorrent`/`AddUrl`.

It never asserts the user-visible contract: no `Could not contact QuickGet` toast, no save dialog,
no local `DownloadItem`, and exactly one terminal outcome. The fixture page is opened only after
the extension and worker are ready, so it cannot expose an orphaned/stale content script or a
worker/message-channel transition across extension reload/update. It also runs with Playwright's
managed download behavior, while this repository already documents that native download handling
can skip or change relevant Chrome stages. The unit test compounds the false confidence by
constructing a synthetic event and overriding `isTrusted`; it validates the pure classifier, not a
trusted browser click or delivery to a live worker.

**Acceptance:** add a real-Chromium outcome test using native download handling, assert absence of
both a local file/`DownloadItem` and error feedback after a successful Shift hand-off, and add a
persistent-tab extension-lifecycle case. The test must fail when `runtime.sendMessage` has no
receiver or the native save path proceeds, even if the mock NAS request happens in another arm.

**Resolved 2026-09-13** — the E2E now uses native Chrome download handling and records both the
download-history and filesystem baselines. It reinjects the actual built manifest content script
into an already-open tab, then requires the Shift-click to add neither a `DownloadItem` nor a file,
render `Sent to Download Station`, omit `Could not contact QuickGet`, and create the expected NAS
task. The content-script unit test separately requires a failed Shift-click to stop propagation
and expose both recovery actions.

One harness limit is explicit: `chrome.runtime.reload()` unloads a side-loaded extension under
Playwright instead of modelling a Web Store update. The update hook and tab iteration are therefore
covered at unit level, while the persistent-tab E2E exercises their real reinjection mechanism and
its browser-visible outcome.

**Contract tests corrected 2026-09-13** — native-download E2E now proves both halves separately:
ordinary `.torrent` produces `AddTorrent`, a real `sample.torrent` file, and one retained
`DownloadItem`; Shift-click produces `AddTorrent` while both the file count and `DownloadItem`
count stay at their baselines. The magnet E2E requires ordinary click to send `AddUrl` without
setting `defaultPrevented`; Shift magnet remains fully claimed by QuickGet. The browser decides
whether its native flow displays a dialog, so tests assert the underlying observable browser
outcome rather than pretending headless Playwright can inspect native UI.
