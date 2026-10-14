---
type: "task"
id: "BUG-68"
status: "done"
priority: "p2"
area: "testing/tooling"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# The test stand is a hand-rolled `node:http` switch; it should be a small Hono server

**Severity:** medium · **Area:** testing/tooling
**Files:** `tests/e2e/support/testStandHost.ts`, `scripts/start-stand.ts`, `package.json`

`testStandHost.ts` is a single `createServer` callback with a chain of `if (pathname === …)`
branches, a `send()` helper that only writes whole buffers, and one hand-written streaming branch
bolted on beside it. It has grown past what that shape carries well, and every fixture the
RES-5 work needed was another branch in the same `if`-chain.

**Proposal: rewrite it as a small [Hono](https://hono.dev) app.** Hono is routing-only, has no
runtime dependencies to speak of, and runs on `@hono/node-server`, so this stays a dev dependency
and does not touch the extension bundle.

What that buys, concretely:

- **Real routes** — `/files/:name`, `/page.html`, `/dl.php` — instead of ordered `if`s, with
  params and query parsing rather than manual `URL` picking.
- **Streaming as a first-class thing.** The throttled large-file endpoint is currently a
  hand-written `pump()` with its own drain handling; a framework with a streaming helper makes
  variable-rate serving a parameter rather than a special case.
- **Rate as a dimension, not one endpoint.** The point of this card: any file should be servable
  at any speed. `?kbps=` on everything, plus a first-byte delay, plus optional mid-transfer stall
  and abort — the shapes a download client actually has to survive. Today only
  `large-<n>mb.bin` can be slowed, and `bodyDelayMs` is a whole-host setting.
- **Middleware for the cross-cutting parts** — the request log, `no-store`, CORS if it is ever
  needed — instead of repeating headers per branch.

**Requirements the rewrite must keep**, all of them load-bearing today:

1. `requestLog` with `{ path, method }`, which E2E asserts against (`getsFor` in
   `file-interception.spec.ts` counts GETs to prove no bytes flowed).
2. Per-link generated torrents — `buildTorrent(contentName)` — so routing can be tested on the
   real `info.name` rather than on a shared fixture.
3. `Content-Disposition` and MIME behaviour per path, including the tracker-style routes that
   reveal a name only through a header, and `/dl.php` which reveals nothing.
4. Binding: loopback by default, every interface under `QNAP_STAND_LAN=1`, with the LAN address
   printed. A real NAS cannot fetch loopback.
5. `no-store` on the page. It is edited while it is open.
6. Ephemeral port by default, fixed `3300` for the manual stand.

**Worth deciding during the rewrite, not before:** whether the served page moves out of one
1100-line `index.html`, and whether the mock NAS (`mockNas.ts`, a separate hand-rolled server
with the same shape) should move too or stay as it is. Doing both at once is the tempting mistake
— the mock NAS has a contract spec of its own (`mockNas.contract.spec.ts`) and a different risk
profile.

**Not urgent.** The stand works; `large-<n>mb.bin` covers the immediate need for a watchable
transfer, and this card exists so that stopgap is replaced deliberately rather than grown.

**Resolved 2026-09-13** — rewritten as a Hono app: `testStand/app.ts` for routes,
`transfer.ts` for delivery, `barriers.ts` for determinism. Every requirement listed above is kept.
Delivery became a dimension as planned (`?kbps=`, `?delayMs=`, `?barrierAt=`, `?abortAt=`,
`?truncateAt=`, `?nolength=`, Range, redirect chains, error statuses), the fixture gained a
contract spec of its own under a separate vitest project, and the stand page gained a `#delivery`
tab. `mockNas.ts` was deliberately left alone.

Two findings the rewrite surfaced, both invisible before:

- **`serve()` from `@hono/node-server` replaces `globalThis.Response`.** Any library doing an
  `instanceof Response` check then fails — `openapi-fetch` throws *"onResponse: must return new
  Response()"* the moment the stand runs in the same process as the API client. Fixed with
  `overrideGlobalObjects: false`; measured, not guessed.
- **The fixture torrent was invalid.** One 20-byte `pieces` hash described a 1 MiB file at a 16 KiB
  piece length — 64 pieces' worth. The mock never looked; a real Download Station answered `16384`.
  `pieces` is now sized from the content.
