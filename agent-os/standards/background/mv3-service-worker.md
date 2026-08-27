# MV3 Service Worker

The background is a Manifest V3 service worker — it is killed and restarted constantly.

- **Register every `chrome.*` listener synchronously during module evaluation.** A listener
  added after an `await` will not wake the worker. `src/background/index.ts` calls
  `initDownloadInterception()` at top level for exactly this reason.
- **Never keep state in module globals.** The worker is suspended after ~30s idle and its
  memory is gone. Persist to `chrome.storage.session` (transient) or `chrome.storage.local`
  (durable), and read it back on every event.
- **The background is the single writer of the toolbar action.** Other contexts message it
  (`MONITOR_MESSAGE`, `SNAPSHOT_MESSAGE`); they never call `chrome.action.*` themselves.

## Destructive browser operations must be transactional

Never cancel, erase, or otherwise destroy a user's browser download before the NAS has
accepted the hand-off:

```
identify → guard credentials → pause → send to NAS
  → success: cancel the browser download
  → failure: resume it
```

A `.torrent` is small enough that the browser finishes fetching it during the NAS round-trip.
This ordering is the fix for a real data-loss defect — see `docs/download-interception-bugs.md`.

## Credential preconditions apply to background entry points too

Locking is not only a popup concern. Before any background code path uses the NAS client:

```ts
if (!settings.NASpassword) return; // locked, or session storage cleared by a restart
```

`isLocked()` is **not** a sufficient guard — it returns `false` when `rememberPassword` is
off, even though the password is empty after a browser restart. Use it only to choose the
wording of a notification.
