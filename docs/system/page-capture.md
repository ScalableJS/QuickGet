---
type: architecture
status: active
area: content
updated: 2026-10-10
features: ["page-capture"]
---

# Magnet and ordinary-file page capture

## Eligible clicks

The content script intercepts trusted, cancellable primary-button clicks without Ctrl, Meta, or Alt. Anchor lookup uses the composed path for nested and shadow-DOM content. Magnets are captured automatically. Ordinary HTTP(S) links are eligible only when the anchor has `download` or its pathname has a known downloadable extension. A query string that merely mentions a file is not enough. PDFs normally remain in the browser viewer; explicit `download` changes that intent.

Ordinary capture is off by default. Enabling the setting captures eligible ordinary clicks; Shift sends one eligible ordinary file while the setting is off. Torrent links belong to [[torrent-handoff]], not this file switch. Blob, data, local-file and other browser-only schemes are not NAS-fetchable.

## Sending and fallback

`task:add` carries a magnet and origin page to the worker's magnet handler. `link:send` carries an ordinary URL to the shared context-menu transport. Runtime-message inputs are checked at the worker boundary. Page feedback shows loading, accepted success, duplicate acceptance, and failure; dynamic messages and action labels use literal text. Magnet and ordinary-link sends share their dispatch/claim/callback lifecycle while payloads and failure wording remain explicit.

Known NAS rejection, a missing receiver, or a synchronous invalidated extension context restores native handling by activating a detached anchor with the captured URL, target and download attribute. Page click handlers are not replayed. This fallback belongs to the content script, independently of the browser-torrent transaction.

A closed message port, missing reply or other uncertain transport failure does not establish rejection: the NAS may already have accepted the request. Such a request retains its per-URL claim, gives persistent uncertainty feedback and asks the user to check Download Station. After 30 seconds without a reply the UI reports the same uncertainty; this is not a transport timeout, automatic retry or fallback. A later reply can resolve the current owned notice. Dismissal, a newer gesture and teardown prevent old completions from reviving or replacing feedback. The pending-dispatch map is the single owner of duplicate-send claims.

The NAS fetches ordinary file bytes itself. A URL that needs page cookies or server-side redirect resolution can fail at the NAS despite a successful browser session. The current phase does not promise arbitrary authenticated-download support. Popup URL sends have the same NAS network reachability restriction.

## Reinjection

The content script is built as a standalone IIFE rather than a cached dynamic module, so every injection gets the current extension context. On the first worker start of an extension lifetime, the background injects manifest scripts into existing HTTP(S) tabs and records completion in session storage. That marker survives ordinary worker suspension and resets with extension reload. The update-only event hook was insufficient in the reproduced real-reload sequence.

Replacement cleanup removes document listeners before touching an old storage API that can already be unreachable, then invalidates owned feedback. An invalidated listener in an obsolete isolated context also retires itself before claiming the next click, allowing the current handler to receive the same trusted event. No page-controlled cleanup bridge is used. It then attaches one current handler. Pending claims are per-page request state, not a durable link-history database. Tabs may disappear or forbid injection; the background tolerates those failures. The retained-tab E2E uses actual runtime.reload in a temporary developer-mode profile and never reloads or injects the website from the test.

## Sources and evidence

- [magnet.ts](../../src/content/magnet.ts), [magnetHandler.ts](../../src/background/magnetHandler.ts), [contentScripts.ts](../../src/background/contentScripts.ts), [worker messages](../../src/background/index.ts).
- [Magnet E2E](../../tests/e2e/magnet-interception.spec.ts), [ordinary-file E2E](../../tests/e2e/file-interception.spec.ts), and content/worker unit tests.
- [RES-5](../../tasks/RES-5.md) is the shipped phase; [GAP-15](../../tasks/GAP-15.md) tracks unresolved URL redirects.
