---
type: "task"
id: "GAP-1"
status: "done"
priority: "p2"
area: "background/content"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Done"
size: "M"
---

# `magnet:` clicks are never intercepted

**Size:** M · **Area:** background/content
**Files:** `src/content/magnet.ts`; `src/background/magnetHandler.ts`; `manifest.json` + `manifest.firefox.json`;
`src/lib/config.ts` (`DEFAULTS`); `src/popup/features/settings/Settings.svelte`; `tests/e2e/magnet-interception.spec.ts`

We intercept `.torrent` **files** through the downloads API, but a `magnet:` click never
reaches that API — the browser hands it straight to an external application. So the single
most common way to start a torrent silently bypasses the extension.

Competitors treat this as a headline feature, not an extra:

- *Download Station (Synology)*, Firefox — "Auto-capture magnet links and send them to your
  Synology NAS" is listed **first** in its feature list.
- *Send To QNAP++* — "Universal Support — Seamlessly handle Torrents, Magnets, and standard
  HTTP/HTTPS files".
- *NAS Download Manager* — "Open some types of links (e.g. `magnet:`) in the extension
  rather than a desktop application".

**The permission question is already settled — check the manifest before re-opening it.**
`manifest.json` today declares `host_permissions: ["http://*/", "https://*/"]` plus
`scripting`. The broad host grant **is already there**, and the install-time warning the user
sees ("Read and change all your data on websites you visit") does not change by adding a
content script. So a manifest-declared script costs no new permission and no new warning; an
optional-permission flow would add a consent step the user has effectively already given, for
no reduction in what we can reach. Declare it in the manifest, and keep the *behaviour*
opt-in through the setting below.

**Acceptance criteria**

- [x] With `autoCaptureMagnets` on, a left-click on `<a href="magnet:?xt=...">` sends the URI
      to the NAS and no external application is launched.
- [x] With the setting off, no listener is attached and the click behaves exactly as today.
- [x] Toggling the setting takes effect in already-open tabs without a reload
      (`chrome.storage.onChanged`).
- [x] Modified clicks (middle-click, ⌘/Ctrl-click) and non-primary buttons are left alone.
- [x] A magnet click while the NAS is unreachable surfaces the same error path as a
      `.torrent` hand-off, and does **not** silently swallow the navigation (isolated Shadow DOM toast feedback with `[Open locally]` and `[Retry]`).
- [x] Firefox parity is decided explicitly: `manifest.firefox.json` includes `src/content/magnet.ts`.

**Resolution & Implementation Notes (2026-09-04)**
- Implemented with *Synchronous Cancellation + Compensating Fallback* pattern (consulted with ChatGPT Gateway): DOM event dispatch cannot await promises before calling `preventDefault()`. Cancellation is synchronous in capture phase; failures trigger an isolated Shadow DOM toast (`#quickget-feedback-host`) providing user-initiated fallback to open locally (`window.location.href`) or retry.
- Security: Enforces `event.isTrusted === true` to block synthetic script clicks from untrusted origins.
- Robust traversal: Uses `event.composedPath()` to support nested elements, icons, and Web Components / open Shadow DOM.
- Reuses existing routing rules engine (`classifyUrl`, `resolveDestination`) to preserve destination folder mapping.
- Full E2E coverage via mock NAS (`tests/e2e/magnet-interception.spec.ts`) and unit tests (`magnet.test.ts`, `magnetHandler.test.ts`). Existing `.torrent` flow completely unaffected.
