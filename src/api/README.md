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
