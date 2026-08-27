# Кеширующая прослойка с TTL для QNAP Download Station API

Расширение общается с QNAP Download Station всего по двум «горячим» направлениям: хранит активный SID (сессию) и периодически делает POST-запрос `/downloadstation/V4/Task/Query` для списка задач. Оба вызова нужно кешировать, чтобы не перегружать NAS и синхронизировать несколько контекстов (popup, action-иконка, service worker). Поэтому кеширующая прослойка должна быть асинхронной, работать с JSON, поддерживать TTL и легко переиспользоваться вне Chrome. Ниже собраны основные кандидаты и подходы.

## IndexedDB / storage-ориентированные решения

- **`idb-keyval` + `idb-lru`**  
  Лёгкая обёртка над IndexedDB. Пакет `idb-lru` добавляет TTL (`maxAge`) и ограничение по размеру. Хорошо подходит для простого кэша без лишних зависимостей.

- **`idb-lru-cache`**  
  Альтернатива предыдущему, реализующая LRU-алгоритм поверх IndexedDB с поддержкой `maxAge`.

- **`dexie` + плагины (`dexie-observable`, `dexie-live-query`)**  
  Dexie предоставляет полноценный слой для IndexedDB с транзакциями и реактивными подписками. TTL не встроен, но легко реализуется через поле `expiresAt` и периодическую очистку. Удобно для сложных схем и больших данных.

- **`@tanstack/query-core` + `@tanstack/query-persist-client-idb`**  
  Ядро TanStack Query работает без React, поддерживает `staleTime`/`cacheTime` (TTL). Плагин для IndexedDB обеспечивает персистенцию. Достоинство — тот же подход можно использовать в React/React Native, просто сменив адаптер.

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
            return queryTasks(); // наш API клиент
          }
          throw new Error("Unknown query");
        },
        staleTime: 10_000,  // данные считаются свежими 10 секунд
        cacheTime: 60_000,  // в памяти держим минуту
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
    maxAge: 60_000, // TTL для записей в IndexedDB
  });

  // где-то в сервис-воркере:
  async function getDownloads() {
    return queryClient.fetchQuery({ queryKey: ["downloads"] });
  }
  ```

## In-memory / гибридные варианты

- **`lru-cache` (npm-пакет)**  
  Позволяет задавать `ttl`, `ttlResolution` и `allowStale`. Можно держать данные в памяти и синхронизировать с `chrome.storage` или IndexedDB.

- **`quick-lru`**  
  Минималистичная LRU-реализация с `maxAge`. Подходит, если требуется небольшой кэш плюс ручная персистенция.

- **`async-cache-dedupe`**  
  Асинхронный кэш с дедупликацией и TTL. Удобен, когда важно предотвращать параллельные одинаковые запросы. Можно адаптировать к любому бэкенд-хранилищу.

## Обёртки над Chrome Storage

- **`chrome-storage-cache`**  
  Простая прослойка с TTL над `chrome.storage.local`. Идеальна для быстрого внедрения в расширение, минимизирует количество POST-запросов.

- **`chrome-storage-wrapper`**  
  Поддерживает поле `expire`, но используется реже. Рассматривать как альтернативу, когда нужна исключительно работа с `chrome.storage`.

## Рекомендованный подход

- Если цель — **минимальная интеграция в расширение**: берём `chrome-storage-cache` или `idb-keyval`/`idb-lru`.
- Если важна **долгосрочная переиспользуемость** в React/нативе: используем `@tanstack/query-core` или `dexie` с кастомным TTL, оборачиваем их в общий `ResourceStore`.

В любом случае разумно скрыть выбранную библиотеку за собственным интерфейсом (например, `createResourceStore`), чтобы UI и бизнес-логика не зависели от конкретной реализации и могли мигрировать между проектами.

## Самописный AsyncStore на базе `idb-keyval`

Если не хочется тянуть сторонний кэш, можно написать лёгкую обёртку над `idb-keyval`, поддерживающую промисы, TTL и middleware:

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

Использование:

```ts
const store = new AsyncStore()
  .use(async (ctx, next) => { const started = performance.now(); await next(); console.debug(ctx.key, performance.now() - started); })
  .use(async (_ctx, next) => { try { await next(); } catch (error) { console.error("[store]", error); throw error; } });

await store.set("downloads", snapshot, 5_000);
const cached = await store.get("downloads");
```

## SID и retry-логика

- `store.get("sid")` сначала пытается вернуть значение из стора; если нет — запускает логин.
- Чтобы избежать гонок, применяется shared-промис (`sidPromise`) — только первая параллельная попытка делает запрос, остальные ждут.
- После успеха SID сохраняется с TTL (время жизни cookie); при ошибке входа ключ очищается.
- При ответе NAS с ошибкой авторизации (`401/403`) SID инвалидация выполняется сразу, что заставляет следующий вызов получить новую сессию.
- Переиспользуемый helper `withRetry(task, { retries: 3, delayMs: 1000 })` гарантирует, что вход выполняется максимум три раза; после этого исключение пробрасывается в UI.

## Кэш единственного запроса

- «Горячий» вызов — `/downloadstation/V4/Task/Query`. Его можно перехватить middleware до сетевого запроса и вернуть ответ прямо из стора, минуя сеть.
- Мутации (`addTorrent`, `startTask`, `stopTask`, `removeTask`) вызывают `invalidate("downloads")`, чтобы следующий вызов списка выполнился заново.
- Идеальный владелец кэша — background service worker: он отвечает за расписание обновлений, распределяет данные между popup/иконкой через `chrome.storage` или `runtime.sendMessage`.
- Воркер может запускать обновления «по сетке» (0, 5, 10 секунд каждой минуты), создавая `chrome.alarms` с `when = ceil(now/interval)*interval`.

Такой стек закрывает текущие нужды (SID + список задач) и остаётся расширяемым:

- **Если достаточно собственного решения** — используем `AsyncStore` поверх `idb-keyval`: SID и список задач обслуживаются одной прослойкой, дополнительный функционал добавляется через middleware и adapters (например, публикация обновлений в `chrome.storage`).
- **Если потребуется готовый движок** — тот же интерфейс можно переключить на Dexie или TanStack Query (persisted в IndexedDB), оставив API и потребителей неизменными.
