---
type: architecture
status: active
area: content
updated: 2026-10-09
features: ["page-capture"]
---

# Magnet and ordinary-file page capture

## Eligible clicks

The content script intercepts trusted, cancellable primary-button clicks without Ctrl, Meta, or Alt. Anchor lookup uses the composed path for nested and shadow-DOM content. Magnets are captured automatically. Ordinary HTTP(S) links are eligible only when the anchor has `download` or its pathname has a known downloadable extension. A query string that merely mentions a file is not enough. PDFs normally remain in the browser viewer; explicit `download` changes that intent.

Ordinary capture is off by default. Enabling the setting captures eligible ordinary clicks; Shift sends one eligible ordinary file while the setting is off. Torrent links belong to [[torrent-handoff]], not this file switch. Blob, data, local-file and other browser-only schemes are not NAS-fetchable.

## Sending and fallback

`task:add` carries a magnet and origin page to the worker's magnet handler. `link:send` carries an ordinary URL to the shared context-menu transport. Runtime-message inputs are checked at the worker boundary. In-page feedback shows loading, success, and failure. A failed send restores native navigation through the content-script fallback; the content script owns that navigation, not the browser-download transaction.

The NAS fetches ordinary file bytes itself. A URL that needs page cookies or server-side redirect resolution can fail at the NAS despite a successful browser session. The current phase does not promise arbitrary authenticated-download support. Popup URL sends have the same NAS network reachability restriction.

## Reinjection

On extension update, the background injects manifest scripts into existing HTTP(S) tabs. The content script calls prior document/storage-listener cleanup before replacing listeners. The in-flight click guard exists while the clicked operation is awaiting a response; it is not a durable link-history database. Tabs may disappear or forbid injection, and the background tolerates those failures.

## Sources and evidence

- [magnet.ts](../../src/content/magnet.ts), [magnetHandler.ts](../../src/background/magnetHandler.ts), [contentScripts.ts](../../src/background/contentScripts.ts), [worker messages](../../src/background/index.ts).
- [Magnet E2E](../../tests/e2e/magnet-interception.spec.ts), [ordinary-file E2E](../../tests/e2e/file-interception.spec.ts), and content/worker unit tests.
- [RES-5](../../tasks/RES-5.md) is the shipped phase; [GAP-15](../../tasks/GAP-15.md) tracks unresolved URL redirects.
