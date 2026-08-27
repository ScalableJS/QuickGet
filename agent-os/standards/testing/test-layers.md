# Test Layers

Two layers, different jobs. Pick by what the test must prove, not by convenience.

## Unit — Vitest + jsdom

- `chrome.*` comes from the hand-written mock in `tests/mocks/chrome.ts` (`vi.stubGlobal`),
  **not** from a library. Adding a test for a new `chrome` API means extending that mock first.
- HTTP is mocked with MSW (`tests/msw/server.ts`).
- Use unit tests for branching, guards, and **call ordering** — assert order with
  `vi.fn().mock.invocationCallOrder`, which is how a "cancel before send" class of bug is caught.

## E2E — Playwright

- `launchPersistentContext` with `channel: "chromium"` and `headless: true` is the only way to
  load an extension. Plain `--headless` does not; MV2 is no longer supported at all.
- Get the extension id from the service-worker URL —
  `context.serviceWorkers()[0]`, falling back to `waitForEvent("serviceworker")`
  (`tests/e2e/support/extension.ts`).
- `worker.evaluate()` runs inside the service worker with full `chrome.*` access — use it to
  seed `chrome.storage` and to assert real state such as `chrome.downloads.search()`.
- The worker suspends after ~30s idle. Playwright keeps the same `Worker` object and stalls
  `evaluate()` across the restart, but **in-memory state is lost** — assert through
  `chrome.storage`, never through module globals.
- E2E runs against `dist/`, so `npm run build` must precede it.
- No fixed `waitForTimeout` for event-driven flows; poll with `expect.poll`.

## Which layer proves what

Unit tests prove that the right `chrome` API was called in the right order. Only E2E proves
the browser actually did it — that a cancelled download really stops, or that a resumed one
really completes.

## Mock NAS

`tests/e2e/support/mockNas.ts` speaks the real Download Station V4 contract and records every
request. Assert against `mockNas.requestLog` rather than stubbing the API client.
There is also an opt-in real-NAS suite behind `QNAP_E2E_REAL=1`; keep mutating cases tagged
`@mutating` so they stay out of the default run.
