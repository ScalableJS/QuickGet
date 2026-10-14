---
type: "task"
id: "BUG-40"
status: "done"
priority: "p2"
area: "popup/settings"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Saving settings hangs on "Saving…" for >10s when NAS is unreachable or credentials invalid

**Severity:** medium · **Area:** popup/settings
**Files:** `src/popup/features/settings/Settings.svelte`, `src/api/index.ts`, `src/lib/connectionHealth.ts`

When saving connection settings while the NAS server is unreachable (offline, sleeping host, wrong IP/port,
firewall dropping packets, or invalid credentials), the UI button displays `Saving…` and blocks the interface
for more than 10 seconds (up to 30s depending on OS/Chromium TCP timeout). The UI briefly flashes a green
"Settings saved" message while still spinning on "Saving…", and only then turns into a red error.

**Root causes:**
1. **No client-side request timeout on `fetch` (`src/api/index.ts` & `src/api/client.ts`):** Neither
   `requestLogin` nor openapi-fetch configure an `AbortSignal.timeout(...)`. When the target NAS is unreachable
   (e.g., non-responsive LAN IP or offline NAS), Chromium's underlying network stack performs TCP SYN
   retransmissions (1s, 2s, 4s, 8s, 16s...), hanging for 10–30+ seconds before rejecting with
   `TypeError: Failed to fetch` or `ERR_CONNECTION_TIMED_OUT`.
2. **Coupled Save & Test state (`Settings.svelte`):** `save()` persists settings to storage (~2ms) but immediately
   awaits `testConnection()`. The `isSaving` state remains `true` throughout the entire network timeout,
   so the button misleadingly displays "Saving…" instead of completing the save phase or displaying an explicit
   "Connecting to NAS… / Testing…". To the user, it appears as though saving settings to the browser is frozen.
3. **Double network round-trip on auth error (`performLogin` in `src/api/index.ts`):** When the NAS is reachable
   but credentials are wrong, QNAP Download Station returns error 4. `performLogin` executes a second sequential
   request with raw password. Combined with QTS PAM anti-brute-force delays (2–4s per failed attempt), this
   adds another 5–8s of delays.
4. **Premature success flash:** `showStatus("Settings saved", "success")` is fired before `testConnection()`
   runs, causing confusing UI state transitions (green success briefly shown right before red network/auth failure).

**Proposed fix:**
1. **Enforce network timeouts on connection test:** Add `signal: AbortSignal.timeout(4000)` (or 5000ms) to
   `testConnection()` and `requestLogin()`, failing fast with a clear "NAS unreachable" rather than hanging for 10–30s.
2. **Decouple `isSaving` from `isTesting`:** Complete `isSaving = false` as soon as `saveSettings()` finishes (~2ms),
   and show an explicit "Testing connection…" state or inline card spinner for the network check.
3. **Only show final status:** Announce "Settings saved. Testing connection…" or defer the status alert until
   the connection verification concludes.

**Resolved 2026-09-12** — shipped in v2.4.1. All four root causes, plus one the analysis did not name.

1. **The check is a ping, not a task query.** `pingNas()` (`src/lib/connectionHealth.ts`) asks
   Download Station one question — will you log me in right now — inside a 5 s budget, and
   returns health rather than throwing. It replaced a login *followed by* a `Task/Query`, so the
   test is now one round-trip instead of two and its three outcomes map exactly onto the three
   states worth telling apart.
2. **Every login carries a deadline.** `performLogin` defaults to `LOGIN_TIMEOUT_MS` (8 s) and
   accepts a caller's signal, shared across both password-encoding attempts so the raw-password
   retry spends the same budget instead of a second one. This bounds *every* call in the
   extension, not only the settings screen: each one starts with a login.
3. **Saving and checking are two actions.** `isSaving` is released when storage is written — a
   millisecond — and the connection test runs after the try/finally with its own `isTesting`.
   The button can no longer be held by the network.
4. **No premature green.** Success is withheld while a check is pending: the pill reads
   "Settings saved — checking the NAS…" until the ping answers.
5. **The verdict stopped being guessed from message text.** This was the unnamed one. Health was
   classified by matching words in the error, so `NAS login failed: Bad Gateway` — a proxy, not a
   password — read as "Authentication failed". A `LoginError` class now carries the code
   Download Station answered with; the transport-level messages were reworded to stop
   impersonating it. (A `code` *property* was the first attempt and was wrong: `DOMException`
   has one too, so an aborted request passed for a rejected password.)

The card now shows what the check found — which host did not answer, and within what budget —
instead of a bare label. Covered by 11 unit tests and 4 E2E arms in
`tests/e2e/settings-connection.spec.ts`: reachable, wrong password, refused connection, and a
host that accepts the connection and then goes silent. The last two assert the clock, because
the verdict was never the broken part — its arrival time was.
