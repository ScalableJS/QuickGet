# TTL caching layer for the QNAP Download Station API

The extension talks to QNAP Download Station over just two "hot" paths: it holds an active SID (session) and periodically makes a POST request to `/downloadstation/V4/Task/Query` for the task list. Both calls need to be cached to avoid overloading the NAS and to keep multiple contexts (popup, action icon, service worker) in sync. So the caching layer needs to be asynchronous, work with JSON, support TTL, and be easy to reuse outside Chrome. Below are the main candidates and approaches.

## IndexedDB / storage-oriented solutions

- **`idb-keyval` + `idb-lru`**
  A lightweight wrapper over IndexedDB. The `idb-lru` package adds TTL (`maxAge`) and a size limit. Good fit for a simple cache without extra dependencies.

- **`idb-lru-cache`**
  An alternative to the above, implementing an LRU algorithm on top of IndexedDB with `maxAge` support.

- **`dexie` + plugins (`dexie-observable`, `dexie-live-query`)**
  Dexie provides a full-featured layer over IndexedDB with transactions and reactive subscriptions. TTL isn't built in but is easy to implement via an `expiresAt` field and periodic cleanup. Convenient for complex schemas and large data volumes.

- **`@tanstack/query-core` + `@tanstack/query-persist-client-idb`**
  The TanStack Query core works without React and supports `staleTime`/`cacheTime` (TTL). The IndexedDB plugin provides persistence. The advantage: the same approach can be used in React/React Native by simply swapping the adapter.

  ```ts
  import { QueryClient } from "@tanstack/query-core";
  import {
    persistQueryClient,
  } from "@tanstack/query-persist-client-core";
  import {
    createIDBPersister,
  } from "@tanstack/query-persist-client-idb";
  import { queryTasks } from "../src/api/downloads.js";

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: ({ queryKey }) => {
          if (queryKey[0] === "downloads") {
            return queryTasks(); // our API client
          }
          throw new Error("Unknown query");
        },
        staleTime: 10_000,  // data is considered fresh for 10 seconds
        cacheTime: 60_000,  // kept in memory for a minute
      },
    },
  });

  const persister = createIDBPersister({
    dbName: "quickget-cache",
    storeName: "tanstack-query",
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 60_000, // TTL for entries in IndexedDB
  });

  // somewhere in the service worker:
  async function getDownloads() {
    return queryClient.fetchQuery({ queryKey: ["downloads"] });
  }
  ```

## In-memory / hybrid options

- **`lru-cache` (npm package)**
  Lets you set `ttl`, `ttlResolution`, and `allowStale`. Data can be kept in memory and synced with `chrome.storage` or IndexedDB.

- **`quick-lru`**
  A minimalist LRU implementation with `maxAge`. Suitable when a small cache plus manual persistence is enough.

- **`async-cache-dedupe`**
  An asynchronous cache with deduplication and TTL. Useful when it matters to prevent parallel identical requests. Can be adapted to any backend store.

## Wrappers over Chrome Storage

- **`chrome-storage-cache`**
  A simple TTL layer over `chrome.storage.local`. Ideal for quick integration into the extension, minimizes the number of POST requests.

- **`chrome-storage-wrapper`**
  Supports an `expire` field but is used less often. Consider it an alternative when the requirement is strictly to work with `chrome.storage`.

## Recommended approach

- If the goal is **minimal integration into the extension**: use `chrome-storage-cache` or `idb-keyval`/`idb-lru`.
- If **long-term reusability** in React/native matters: use `@tanstack/query-core` or `dexie` with a custom TTL, wrapping them in a shared `ResourceStore`.

Either way, it makes sense to hide the chosen library behind your own interface (e.g., `createResourceStore`), so the UI and business logic don't depend on the specific implementation and can migrate between projects.

## Custom AsyncStore on top of `idb-keyval`

If you'd rather not pull in a third-party cache, you can write a lightweight wrapper over `idb-keyval` that supports promises, TTL, and middleware:

```ts
import { get, set, del } from "idb-keyval";

interface Entry<T> { value: T; expiresAt?: number }
interface Ctx<T = unknown> { key: string; value?: T; ttlMs?: number; result?: T | null }
type Middleware = <T>(ctx: Ctx<T>, next: () => Promise<void>) => Promise<void>;

export class AsyncStore {
  private middlewares: Middleware[] = [];
  use(mw: Middleware) { this.middlewares.push(mw); return this; }

  async get<T>(key: string): Promise<T | null> {
    const ctx: Ctx<T> = { key, result: null };
    await this.run(ctx, async () => {
      const entry = (await get<Entry<T>>(key)) ?? null;
      if (!entry) return;
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        await del(key);
        return;
      }
      ctx.result = entry.value;
    });
    return ctx.result ?? null;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const ctx: Ctx<T> = { key, value, ttlMs };
    await this.run(ctx, async () => {
      const entry: Entry<T> = { value, expiresAt: ttlMs ? Date.now() + ttlMs : undefined };
      await set(key, entry);
    });
  }

  async delete(key: string): Promise<void> {
    await this.run({ key }, async () => del(key));
  }

  private async run<T>(ctx: Ctx<T>, terminal: () => Promise<void>) {
    const chain = this.middlewares.reduceRight((next, mw) => () => mw(ctx, next), terminal);
    await chain();
  }
}
```

Usage:

```ts
const store = new AsyncStore()
  .use(async (ctx, next) => { const started = performance.now(); await next(); console.debug(ctx.key, performance.now() - started); })
  .use(async (_ctx, next) => { try { await next(); } catch (error) { console.error("[store]", error); throw error; } });

await store.set("downloads", snapshot, 5_000);
const cached = await store.get("downloads");
```

## SID and retry logic

- `store.get("sid")` first tries to return the value from the store; if there isn't one, it triggers a login.
- To avoid races, a shared promise (`sidPromise`) is used — only the first parallel attempt makes the request, the rest wait for it.
- On success the SID is saved with a TTL (the cookie's lifetime); on login failure the key is cleared.
- When the NAS responds with an authorization error (`401/403`) the SID is invalidated immediately, forcing the next call to obtain a new session.
- The reusable `withRetry(task, { retries: 3, delayMs: 1000 })` helper guarantees login is attempted at most three times; after that the exception is propagated to the UI.

## Single-request cache

- The "hot" call is `/downloadstation/V4/Task/Query`. It can be intercepted by middleware before the network request and answered directly from the store, bypassing the network.
- Mutations (`addTorrent`, `startTask`, `stopTask`, `removeTask`) call `invalidate("downloads")` so the next list call runs fresh.
- The ideal owner of the cache is the background service worker: it's responsible for the refresh schedule and distributes data between the popup/icon via `chrome.storage` or `runtime.sendMessage`.
- The worker can run "grid-aligned" refreshes (0, 5, 10 seconds of every minute) by creating `chrome.alarms` with `when = ceil(now/interval)*interval`.

This stack covers current needs (SID + task list) and remains extensible:

- **If a homegrown solution is enough** — use `AsyncStore` on top of `idb-keyval`: SID and the task list are served by a single layer, additional functionality is added via middleware and adapters (e.g., publishing updates to `chrome.storage`).
- **If a ready-made engine is needed later** — the same interface can be switched to Dexie or TanStack Query (persisted in IndexedDB), leaving the API and consumers unchanged.
