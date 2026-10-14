---
type: "task"
id: "BUG-1"
status: "done"
priority: "p1"
area: "settings"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Interception default flipped to `off` and persisted on read

**Severity:** high · **Area:** settings
**Files:** `src/lib/config.ts:38`, `src/lib/settings.ts:53-59,113-114`, `src/lib/settings.test.ts:48`

`DEFAULTS.torrentInterceptMode` is `"off"` while the README promises Always. Worse,
`loadSettings()` writes missing defaults back to storage, so `"off"` becomes a persisted,
valid value — restoring the default alone will not help anyone who already ran the build.
`onInstalled → ensureMonitoring → loadSettings` burns it in without the popup being opened.

**Root cause:** `307c78a` stripped the `VITE_QNAP_*` bundled credentials before the store
release — correct in intent — but rewrote all of `DEFAULTS` and neutralised a behavioural flag
that was never a credential. The same commit changed the test to assert `"off"`.

**Fix:** restore `"always"`; stop persisting behavioural defaults on read; correct the test.

**Depends on:** BUG-8 (migration) — flipping the default without a migration story leaves
existing profiles broken.
**Done 2026-08-27** — default restored to `"always"`; `modeWithDefault` no longer adds the
resolved value to `missing`, so the behavioural flag is resolved in memory only.
`loadSettings()` still backfills the other missing keys — it is not a pure read.
`settings.test.ts` now asserts the flag is *not* persisted, instead of certifying the regression.
