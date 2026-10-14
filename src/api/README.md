---
type: reference
status: active
area: api
updated: 2026-10-09
features: ["qnap-api"]
---

# API module

`src/api/` is the typed boundary for QNAP Download Station. Application code should create a
client through `createApiClient()` rather than making Download Station requests directly.

From a source module such as `src/background/example.ts`:

```ts
import { createApiClient } from "@api/client.js";
import { loadSettings } from "@lib/settings.js";

const client = createApiClient({ settings: await loadSettings() });
const { tasks } = await client.queryTasks();
```

## Module map

- [client.ts](./client.ts) — public `ApiClient` and `createApiClient()` entrypoint.
- [index.ts](./index.ts) — transport setup, base-URL construction, and login helpers.
- [utils.ts](./utils.ts) — API response guards and QNAP error normalization.
- [type.ts](./type.ts) — application-facing schema type exports.
- [schema.d.ts](./schema.d.ts) — checked-in Download Station request and response schema.
- [client.test.ts](./client.test.ts), [index.test.ts](./index.test.ts), and
  [utils.test.ts](./utils.test.ts) — unit coverage for this boundary.

The required Download Station behavior belongs in the
[canonical QNAP contract](../../agent-os/standards/api/qnap-download-station-contract.md).

## Authentication and request lifetime

The base URL comes from configured scheme/address/port, including normalized IPv6 host syntax.
`performLogin()` attempts QNAP's Base64-encoded UTF-8 password form and falls back to plaintext
only when the first login is rejected, within the same abort budget. Base64 is encoding, not
encryption; HTTPS is the transport protection when configured. The normal login budget is
eight seconds; the Settings ping supplies a shorter five-second signal.

Each middleware client owns its SID and single-flight login promise. Protected URL-encoded
requests receive a SID automatically. HTTP 401/403 or body error 5 triggers one fresh login and
one replay of a captured URL-encoded body. Non-replayable bodies surface the original error and
clear the SID for the next call. The replay bypasses middleware to prevent a retry loop.

`AddTorrent` uses a fresh explicit login and multipart upload; it does not claim the same
transparent URL-encoded replay policy. Duplicate torrent errors return a distinct duplicate
outcome. `AddUrl` and `AddTorrent` use the required relative Temp/Target paths; absent Temp is
reported before multipart upload. URL batches preserve independent outcomes with
`Promise.allSettled`. A NAS success envelope means acceptance, not completed download progress.
An unparseable AddTorrent body is rejected even with HTTP 200: HTTP status and words such as
"exists" in HTML/text do not establish success or a confirmed duplicate.

## Operations and boundaries

The public client exposes task query/start/stop/pause/remove, URL/torrent creation, directory
listing, aggregate status, task queue priority, and per-torrent file priority. Popup pause may
fall back to Stop only for the explicit unsupported-API response; other failures remain errors.
QNAP numeric states are normalized in `src/lib/tasks.ts`. `Task/Status` is available, but current
background polling uses `Task/Query`. No Synology transport or arbitrary server compatibility
is implemented.

The checked-in schema defines the typed request/response boundary; it is not runtime evidence
for every firmware. Unit tests cover login encoding, SID expiry/replay, response errors and
request payloads. Real-NAS validation is the separate local release spot check described in
[verification](../../docs/system/verification.md).

## Error and command contracts

createApiError constructs an Error carrying code, reason and optional duplicate/apiUnsupported flags without a construction assertion. isSuccessResponse returns a boolean for supported success envelopes; it does not validate or narrow the full response DTO. Start, Stop, Pause and Remove share a private transport helper restricted to their generated request shapes; each public method retains its own error contract and options.

Duplicate acceptance is limited to Download Station code 8196 and the existing supported 24593 response with duplicate/exist wording. Other codes retain their failure outcome even if their reason contains exist; in particular, code 5 with session-does-not-exist wording is an authentication failure.


## Installed-vendor verification: 2026-10-10

The error comparison now includes primary evidence from the configured NAS's public Download Station assets, including 20488 / ERR_DST_SPEACE_NOT_ENOUGH (destination-folder free space). [The code-quality audit](../../docs/quality/code-quality-audit.md#vendor-error-fact-verification) records asset hashes and the bounded no-extraction decision. API explanations and task-row labels retain their distinct caller contexts. AddTorrent always includes the required move field, including an empty configured value; the NAS still validates the destination. Missing Temp remains a local precondition. No new Target requirement or silent fallback is introduced.
