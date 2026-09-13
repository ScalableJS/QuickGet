# Test Layers

Four layers, different jobs. Pick by what the test must prove, not by convenience.

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
- **Which build a spec loads is deliberate.** The mock suite takes `dist-dev` — the artifact
  developers run unpacked; the real-NAS suite, the store assets and the demo take `dist`, so what
  is validated against live hardware and photographed for the listing is what ships. The paths
  live in `tests/e2e/support/builds.ts`; never write `../../dist` into a spec again.
- Every suite builds its own artifact through a `pretest` script. A stale bundle is
  indistinguishable from a broken feature, and that confusion has cost real time here.
- No fixed `waitForTimeout` for event-driven flows; poll with `expect.poll`.

## Fixture contracts — Vitest + node

The mock NAS and the test stand are servers we wrote, and a fixture that lies produces green
suites about behaviour that does not exist. Both have contract tests of their own; the stand's run
under a separate vitest project (`--project fixtures`) because they bind real sockets, which is
exactly what MSW exists to prevent in the unit layer.

This layer earned its place: the stand's generated torrent carried one 20-byte `pieces` hash for a
file needing 64, the mock never looked, and a real Download Station rejected it outright.

## Production spot check — Playwright + a real NAS

`npm run test:prod-spotcheck`, run before a release, against `dist`. Four scenarios that a mock
cannot answer: connection, `AddTorrent`, magnet `AddUrl`, and a direct link the NAS fetches from
the developer's own machine and then pauses, resumes and removes.

Rules, all of them learned the hard way:

- **Keep it small.** Rebuilding the mock suite against somebody's hardware produces a slow second
  suite that rots — which is precisely what happened to the spec this replaced.
- **Own everything you create.** Prefix, a ledger written *before* creation, and a preflight sweep.
  Cleanup failure fails the gate.
- **Wait on contracts, not clocks.** `Test timeout of 60000ms exceeded` is the message that let the
  previous real-NAS suite sit broken for two months.
- It cannot run in CI: no route to the NAS, and the credentials are deliberately outside Actions.

## Which layer proves what

Unit tests prove that the right `chrome` API was called in the right order. E2E proves the browser
actually did it — that a cancelled download really stops, or that a resumed one really completes.
The spot check proves the appliance agrees, which is the only claim the other three cannot make.

## Mock NAS

`tests/e2e/support/mockNas.ts` speaks the real Download Station V4 contract and records every
request. Assert against `mockNas.requestLog` rather than stubbing the API client.
