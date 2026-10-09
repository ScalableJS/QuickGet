# MV3 Service Worker

- Register browser listeners synchronously during module evaluation; `src/background/index.ts`
  calls the interception initializers before awaiting work.
- Persist state that must survive worker suspension in session or local storage. Operation-scoped
  claims, client caches and short serialization queues may live in memory; they are not durable state.
- The worker owns toolbar icon, badge, title and attention. Other contexts send
  `MONITOR_MESSAGE` or `SNAPSHOT_MESSAGE`; they do not write `chrome.action` directly.

## NAS-first browser handoff

```text
identify -> validate configuration -> live NAS login -> fetch/send torrent
  -> NAS acceptance: cancel browser download, then erase cancelled history
  -> earlier failure: leave normal browser download handling available
```

- Chromium filename deferral holds the save decision during handoff; release the owned callback
  in `finally`. The current transaction does not pause the native download or run a recovery queue.
- A failure after NAS acceptance, such as notification bookkeeping cleanup, must not convert the
  accepted transaction into a failed send or prevent cancellation.
- A failed browser cancellation keeps the browser copy; do not erase before cancellation succeeds.
- Do not promise recovery or exactly-once delivery across worker death from operation-scoped memory.
  [The handoff page](../../../docs/system/torrent-handoff.md) owns the current lifetime boundaries.

## Listener ownership

Take the in-memory download-ID claim synchronously before the first await; release it when the
operation finishes. A storage read followed by a write is not an atomic claim. Do not add persisted
claims, history sweeps or guessed restart mitigation without reproduced causal evidence for BUG-70.

## Credentials and settings lock

Background entry points validate configuration through `findConfigProblem()` and use a live
login before handoff. `loadSettings()` supplies the current credential; session storage can
supplement the locally persisted NAS password. The optional settings password protects the
Settings screen only, and does not gate background operations or encrypt NAS credentials.
Do not restore the retired `rememberPassword` / `isLocked()` background contract.
