# Download interception — bug report

Recorded 2026-08-27 against `env/dev` @ `4933b52`.

**Status: BUG-1 through BUG-4, BUG-6 and BUG-8 are fixed** (same day). BUG-7 is partly done —
unit coverage landed, the E2E spec has not. BUG-5 is still open. Live status and resolution
notes: `agent-os/product/bugs-kanban.md`. This document is kept as the analysis of record,
so the "current" tense below describes the code *before* the fix.

Two user-visible symptoms were reported:

1. The extension stopped intercepting `.torrent` downloads — the link never reaches the NAS.
2. When the master password has not been entered, there is no interception *and the link is lost*.

Both reproduce from the source. The manifest, which was the initial suspicion, is not involved.
Findings below were cross-checked against an independent review of a full-repo dump.

---

## BUG-1 — interception is silently disabled, permanently

**Severity:** high — the advertised default feature is off for everyone.

`DEFAULTS.torrentInterceptMode` is `"off"` (`src/lib/config.ts:38`), while `README.md:8,34`
still promises *"enabled by default"* / *"default: Always"*.

The default does not stay in memory. `modeWithDefault` records a missing key into `missing`
(`src/lib/settings.ts:53-59`), and `loadSettings` then writes it back with
`chrome.storage.local.set(missing)` (`src/lib/settings.ts:113-114`). **Reading the settings is a
write operation.** Once `"off"` lands in storage it is a valid persisted value, so changing the
default back does nothing for anyone who already ran the buggy build.

The write does not need the popup to be opened. `chrome.runtime.onInstalled` calls
`ensureMonitoring()` (`src/background/index.ts:30`), which reaches `loadSettings()` through the API
client — so the value is burned in on update, before the user touches anything.

### Why it appeared

Commit `cde6bfb` (2026-06-21) deliberately made `"always"` the default for new installs.
Two days later `307c78a` ("fix(settings): remove bundled configuration defaults") stripped the
`VITE_QNAP_*` build-time defaults ahead of the Chrome Web Store release — a correct change, since
shipping a hardcoded NAS address and login was wrong. But the commit rewrote the whole `DEFAULTS`
object and reset every field to an empty/neutral value, including `torrentInterceptMode`, which was
never a bundled credential and had nothing to do with the stated goal. A behavioural flag got
swept up in a credentials cleanup.

Nothing caught it, because `src/lib/settings.test.ts:48` was updated in the same commit to assert
`expect(snapshot.torrentInterceptMode).toBe("off")`. The test now certifies the regression.

The persistence-on-read behaviour is older and independent — it was written to backfill missing
keys, and is harmless for cosmetic defaults like `theme`. It only became dangerous once a
behavioural flag started flowing through it.

---

## BUG-2 — the browser download is cancelled before the NAS hand-off succeeds

**Severity:** high — silent data loss.

`src/background/downloads.ts:55-56`:

```ts
await cancelBrowserDownload(item.id);
await sendAndNotify(settings, url);
```

The download is killed first and the outcome checked never. Any failure after that line leaves the
user with no file and no NAS task: locked extension, wrong password, NAS offline, network timeout,
QNAP API error, host permission withheld, or a one-time tracker URL that cannot be fetched twice.

`cancelBrowserDownload` deliberately does not erase the item so a "Retry" affordance survives
(`downloads.ts:131`), and that reasoning is sound in isolation — but it is a manual recovery
path the user has to notice. From the outside the link simply vanished.

The correct shape is transactional: pause → hand off → cancel on success, resume on failure.
A `.torrent` is small, so the browser will almost always have finished fetching it by the time the
NAS login and upload complete.

### Why it appeared

Inherited ordering from a feature that no longer exists. Before `2ed381c` there was an `"ask"`
mode: the download was cancelled, the torrent stashed in `chrome.storage.session`, and a
notification with *Send to NAS* / *Choose folder…* buttons was shown. There, cancelling **first**
was necessary and correct — you must stop the browser before asking the user anything.

`2ed381c` ("refactor: remove torrent interception chooser") deleted the `"ask"` branch and collapsed
the body to `cancel(); sendAndNotify();`. The `cancel` call was left where it stood. With only the
`"always"` path remaining, the reason for cancelling early disappeared, but the code did not move.

---

## BUG-3 — locked / empty-credential state is not guarded in the background

**Severity:** high — this is the direct cause of symptom (2).

With `rememberPassword: true` and no unlock after a browser restart, `loadSettings()` returns
`NASpassword = ""` (`src/lib/settings.ts:93`, asserted by `settings.test.ts:144`). The NAS login
then fails — after BUG-2 has already cancelled the download.

`isLocked()` exists (`src/lib/settings.ts:209`) but is used only by the popup
(`src/popup/index.ts:25`). The background never consults it.

Adding an `isLocked()` check would still not be enough. With `rememberPassword: false` the password
lives only in `chrome.storage.session`, which is empty after a browser restart — so `NASpassword` is
`""`, yet `isLocked()` returns **`false`**, because it short-circuits on
`!local.rememberPassword` (`src/lib/settings.ts:212-215`). The guard that actually covers every case
is `if (!settings.NASpassword) return;` before touching the download; `isLocked()` is only good for
choosing the wording of the notification.

### Why it appeared

The lock feature was designed as a popup-UI concern — the popup blocks its own interface until
unlocked, which looks complete from the settings screen. Background entry points were never
enumerated as consumers of the same precondition. `handleDownloadCreated` is a second, headless
entry point into the same NAS client, and it was not revisited when locking was added.

---

## BUG-4 — the hand-off failure is swallowed

**Severity:** medium — on its own cosmetic, but it is what hides BUG-2.

`sendAndNotify` catches, notifies, and returns normally (`src/background/downloads.ts:79-82`).
A rejected NAS operation becomes a fulfilled promise, so the caller cannot distinguish success from
failure and cannot roll the download back. The function also mixes three concerns: the critical
operation, the UI notification, and the error handling.

### Why it appeared

Same `2ed381c` refactor. Under `"ask"`, `sendAndNotify` was invoked from a notification-button
handler where there was genuinely no caller left to propagate an error to — swallowing was correct.
After the refactor it became a step inside a sequence that very much needs to know whether it
worked.

---

## BUG-5 — detection gaps

**Severity:** low — no data loss (misclassification simply skips interception), but real misses.

`isTorrentSource` (`src/lib/torrentSender.ts:57-60`) checks only the MIME type and two URL patterns:

- `/\.torrent(\?|$)/i` does not match a fragment — `foo.torrent#bar` slips through. Should be
  `/\.torrent(?:[?#]|$)/i`.
- `item.filename` is never consulted, even though it often carries the real name from
  `Content-Disposition` when the URL does not.
- Only `chrome.downloads.onCreated` is observed. Chrome may not know the final MIME type or
  `finalUrl` at creation time — both appear in `DownloadDelta`, i.e. they can change later.
  A tracker endpoint like `/download?id=1234` that only reveals `application/x-bittorrent` on
  `onChanged` is never intercepted.

Related, and already acknowledged in `README.md:8`: the `.torrent` is re-fetched from scratch rather
than reusing the bytes Chrome already downloaded, so signed/one-time URLs can fail the second
round-trip. Combined with BUG-2, a documented limitation turns into data loss.

### Why it appeared

`onCreated`-only detection is the simplest thing that works for direct `.torrent` links, which is
what the feature was built and tested against. The `/dl\.php\b/` special case shows the pattern list
grew by anecdote rather than from the delta-based API contract.

---

## BUG-6 — documentation drift

`README.md:8,34` states interception is enabled by default (BUG-1 says otherwise).
`docs/feature-roadmap.md:220` still describes the mode as `off/ask/always`, but `INTERCEPT_MODES`
has been `["off", "always"]` since `2ed381c`. If `"ask"` ever reached users, their stored value is
now invalid and `modeWithDefault` silently rewrites it to `"off"` — feeding BUG-1. Unverified: the
`"ask"` mode may never have shipped.

---

## Why none of this was caught

There is no `src/background/downloads.test.ts`. There used to be one, but it only covered
`sweepStalePending` — a helper of the `"ask"` mode — and was deleted together with the feature in
`2ed381c`. That deletion was correct; the gap is that nothing replaced it. `handleDownloadCreated`,
the function carrying all of the above, has never had a single test.

`tests/mocks/chrome.ts` also has no `chrome.downloads` or `chrome.notifications` stubs at all
(only `storage`, `action`, `runtime`, `contextMenus`, `alarms`), so the mock has to be extended
before such a test can be written.

E2E covers the popup, routing rules, torrent file selection and the mock-NAS contract — but never
the download-interception path, so neither layer would have noticed.

---

## What the manifest audit found

Nothing. `manifest.json` declares `downloads` in `permissions`, `http://*/` + `https://*/` in
`host_permissions`, and an MV3 `service_worker`. Git history shows `downloads` was added once
(`0e2cfa0`) and never removed. `initDownloadInterception()` is called synchronously during module
evaluation (`src/background/index.ts:48`), which is exactly what MV3 requires for a listener to
survive service-worker suspension and wake the worker again.

One caveat: this audit covers the source manifest. The built `dist/manifest.json` is gitignored and
was not inspected. If the installed extension is ever suspect, check it directly in its service
worker console:

```js
chrome.runtime.getManifest();
await chrome.permissions.getAll();
```

---

## Fix order

1. **BUG-2 + BUG-3 + BUG-4** — `src/background/downloads.ts`. One change: empty-password guard,
   then pause → hand off → cancel on success / resume on failure, with the error propagating.
   This is the only data-losing defect; it goes first.
2. **BUG-1** — restore the `"always"` default in `config.ts`, stop persisting behavioural defaults
   on read in `settings.ts`, and correct `settings.test.ts:48`.
3. **Migration.** A stored `"off"` cannot be distinguished between "the bug wrote it" and "the user
   chose it", so it must not be flipped silently. Add a schema version and use
   `onInstalled(details.previousVersion)`; for profiles upgrading from an affected version, notify
   once rather than rewriting the choice.
4. **Tests** — extend `tests/mocks/chrome.ts`, add `src/background/downloads.test.ts`, and one
   E2E spec driving a real download through the mock NAS. See the test plan discussed alongside
   this report.
5. **BUG-5 + BUG-6** — detection hardening and doc corrections, after the above are green.
