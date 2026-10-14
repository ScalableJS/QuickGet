---
type: "task"
id: "GAP-16"
status: "done"
priority: "p2"
area: "background/content"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Done"
size: "L"
---

# Always intercept `.torrent` files, but fall back to the browser on every hand-off failure

**Size:** L · **Area:** background/content
**Files:** `src/background/downloads.ts`, `src/content/magnet.ts`, `src/lib/config.ts`,
`src/lib/settings.ts`, `src/popup/features/settings/Settings.svelte`, interception tests

The torrent-specific checkbox and Shift-only branch make the safest path depend on a user
remembering extension state and a hidden gesture. For `.torrent` files the product direction is
simpler: every normal click is a NAS hand-off attempt, and the browser download disappears only
after Download Station has accepted the torrent. The ordinary-file rule does **not** change:
automatic interception remains off by default, Shift-click sends one file while it is off, and a
plain click sends files only while that separate checkbox is on.

Competitors establish useful boundaries, not an implementation to copy blindly:

- *Send To QNAP++* offers opt-in automatic interception, an explicit local-download bypass and an
  offline queue. Its queue is not suitable here because this card requires immediate browser
  fallback rather than silently changing what a failed click means.
- *Synofox* asks the user to choose NAS or local download after intercepting selected extensions,
  and documents failures on cookie/User-Agent-protected downloads. We want the same preservation
  of the local path without adding a confirmation dialog to every successful torrent.
- Chrome's downloads API exposes `onDeterminingFilename`, `pause`, `resume` and `cancel`.
  `onDeterminingFilename` may provide a cleaner Chromium transaction because completion waits for
  the listener's `suggest()` call, but it is only a candidate until Chromium and Firefox behavior
  is measured in persistent-profile tests.

**Required transaction**

1. Recognize a real `.torrent` response without cancelling or erasing the browser item.
2. Validate configuration, authenticate to the NAS, fetch and validate torrent bytes, then call
   `AddTorrent` exactly once.
3. Cancel/remove the local item only after an unambiguous successful NAS response.
4. On missing/invalid configuration, NAS login or API failure, fetch/validation failure, extension
   restart, timeout, or ambiguous cancellation state, leave or resume the standard browser
   download automatically. A toast or an “Open locally” recovery button is not a substitute.

**Guardrails**

- Remove the torrent checkbox and torrent-specific Shift semantics only as part of this complete
  behavior change. Keep the ordinary-file checkbox and Shift gesture unchanged.
- Do not add persistent download-ID/task-ID deduplication, a startup history sweep, or another
  retry queue. Those mechanisms have no captured bug behind them and can themselves create
  phantom sends.
- Do not claim this fixes the unconfirmed phantom re-download. GAP-16 simplifies interception;
  listener ownership and duplicate-trigger risk are audited separately in ENG-11.
- Treat magnets explicitly: retain automatic NAS hand-off and native-handler fallback, but remove
  their dependence on the torrent checkbox/Shift-only branch. The local-file suppression contract
  above applies to `.torrent` downloads because a magnet creates no browser file.

**Acceptance criteria**

- [x] Plain-clicking a `.torrent` with valid settings creates one NAS task and no retained local
      copy; no torrent interception setting or Shift gesture is required.
- [x] Missing settings, unreachable NAS, rejected login, rejected `AddTorrent`, and invalid torrent
      bytes each complete as an ordinary browser download without a second click.
- [x] Ordinary HTTP/file links preserve the existing matrix: checkbox off means native click and
      Shift sends one; checkbox on means plain click sends to NAS.
- [x] The chosen Chromium and Firefox mechanisms are documented from measured behavior; if full
      parity is impossible, scope is explicit rather than simulated with an unsafe cancel/retry.
- [x] Unit tests assert one `AddTorrent` call and browser ownership for every controlled failure branch;
      persistent-profile Chromium E2E covers restart/no-duplicate behavior; the success and NAS
      failure paths are checked against the live NAS.

**Completed 2026-09-15 — shipped in v2.6.0.** Chromium holds the filename decision while
the NAS hand-off runs, then cancels and erases only after `AddTorrent` succeeds. Every handled
failure releases the decision to Chrome, so its own download continues. This is deliberately
in-memory and transactional, with no stored download ID to replay later. Firefox has no filename-decision event, so it uses
the same post-success cancellation path as before: failures remain browser-safe, while a very
small local file may finish before the success cancellation. That capability difference is
reported rather than hidden behind speculative recovery state.

Magnets are captured without a setting; failed hand-offs navigate to the native handler.
Ordinary files retain the off-by-default checkbox and Shift-only one-shot behavior. Focused unit
tests, the full 45-scenario mock E2E suite, and the six-scenario production NAS spot check are
green, including exact request counts, reinjection, restart/no replay, success/no local copy,
automatic browser fallback, and live `AddTorrent`/`AddUrl`.

**Explicit crash boundary:** termination of the service worker while Chromium is waiting for an
asynchronous filename suggestion is not claimed as a supported recovery path. CDP can stop the
worker, but Chrome exposes neither the held state nor a documented release deadline, and the event
rejects a second observer with `Too many listeners`. A timeout-based test would therefore conflate
browser-version behavior with extension correctness. No persistent ID, startup sweep, or retry
state was added to simulate a guarantee the browser API does not provide.

**Sources checked 2026-09-15:** [Send To QNAP++ on AMO](https://addons.mozilla.org/en-US/firefox/addon/sendtoqnapplus/),
[Synofox on AMO](https://addons.mozilla.org/en-CA/firefox/addon/synofox/),
[Chrome downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads),
and `docs/competitor-routing-teardown.md` for the inspected competitor code paths.
