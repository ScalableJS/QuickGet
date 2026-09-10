# Bugs — Kanban

Single source of truth for open defects. Full analysis and root causes for the interception
bugs live in `docs/download-interception-bugs.md`.

**Columns:** `Backlog` → `In Progress` → `In Review` → `Done`.
Move a card by editing its Status cell; add a dated line under the card when the status
changes. One card per defect, ordered by severity within a column.

---

## Board

| ID | Bug | Area | Severity | Status |
|----|-----|------|----------|--------|
| BUG-34 | Seeding tasks vanish from "In progress" and obscure seeding progress/ETA metrics | popup/UX | medium | Done |
| BUG-35 | Peer and seed counts provided by NAS are never displayed in the popup | popup/UX | medium | Done |
| BUG-36 | Download payload size and progress in bytes (`done` / `size`) are hidden during download | popup/UX | medium | Done |
| BUG-37 | Task failure codes (`error`) from QNAP are ignored instead of displaying failure reason | popup/UX | medium | Done |
| BUG-38 | Destination NAS path (`path` / `move`) is omitted from task details | popup/UX | medium | Done |
| BUG-39 | Toolbar badge background poll fetches full task list instead of lightweight `Task/Status` | background/perf | low | Backlog |
| BUG-40 | Saving settings hangs on "Saving…" for >10s when NAS is unreachable or credentials invalid | popup/settings | medium | Backlog |
| BUG-41 | Saving routing rules with empty optional fields crashes Svelte with props_invalid_value, freezing "Add rule" | popup/settings | high | Done |
| BUG-42 | Routing rules parser edge cases: case-sensitive .torrent, fragile magnet dn parsing, and unhandled URI errors | core/routing | high | Done |
| BUG-43 | Routing rules UX in popup: cramped single-line layout, missing priority reorder controls, and silent rule drop | popup/UX | high | Done |
| BUG-44 | Missing test coverage for routing rules: URL/magnet edge cases, Svelte draft reactivity, and E2E error catching | testing | high | Done |
| BUG-45 | Routing engine ReDoS in matchGlob, sanitizer condition-invariant gap, and type: "all" draft smell | core/routing | high | Done |
| BUG-46 | Routing type detection disagrees with the send-path detector, so `.torrent` rules miss tracker links | core/routing | high | Done |
| BUG-47 | Rules match the URL slug instead of the name the download will actually have | core/routing | high | Done |
| BUG-48 | Rule condition errors are not tied to the fields they describe | popup/a11y | high | Done |
| BUG-49 | Reordering a rule drops keyboard focus and announces nothing | popup/a11y | medium | Done |
| BUG-50 | Rule card small print fails contrast and lowercases the AND it exists to explain | popup/a11y | medium | Done |
| BUG-51 | The axe gate never reaches the routing rules UI | testing | medium | Done |
| BUG-52 | Delete sits next to the reorder arrows and looks identical to them | popup/UX | low | Done |
| BUG-53 | Rule editor a11y polish batch: focus, labels, dead class, literal caps | popup/a11y | low | Done |
| BUG-54 | Popup `.torrent` upload bypasses routing rules entirely | popup/upload | medium | Done |
| BUG-55 | Routing edge cases have no test at the level that can reach them | testing | low | Done |
| BUG-56 | The test stand advertises cases it cannot exercise | testing | low | Done |
| BUG-57 | A wildcard-only pattern is a catch-all the sanitizer was written to prevent | core/routing | medium | Rejected |
| BUG-33 | Torrent interception starts before a live NAS connection is established | background | high | Done |
| BUG-32 | Optimistic toolbar paint left dangling references after the badge refactor | background | high | Done |
| BUG-31 | Successful torrent hand-offs retain a Chrome DownloadItem after restart | background | high | Done |
| BUG-30 | Intercepted `.torrent` still reaches the disk — no filename-stage suppression | background | medium | Done |
| BUG-29 | Tracker-auth send failure is painted as a hard extension error | background | medium | Done |
| BUG-25 | Losing the worker between pause and pending-marker write strands a browser download | background | high | Done |
| BUG-24 | Rejected duplicate listener can release another listener's in-flight ownership | background | high | Done |
| BUG-22 | Invalid settings can stop monitoring while leaving a stale active toolbar | background | high | Done |
| BUG-23 | Failed attention acknowledgement discards the unread reason | background | medium | Done |
| BUG-26 | Monitoring retry after acknowledgement inherits an exhausted error streak | background | medium | Done |
| BUG-28 | Concurrent monitoring requests duplicate QNAP task queries | background/performance | medium | Done |
| BUG-27 | Every monitoring poll reads settings twice | background/performance | low | Done |
| BUG-20 | Monitoring give-up leaves a permanently stale active toolbar | background | high | Done |
| BUG-19 | Rapid zero snapshots can clear an active toolbar prematurely | background | high | Done |
| BUG-18 | Rejected action writes are cached as successfully painted | background | high | Done |
| BUG-21 | Concurrent monitoring requests can recreate and postpone the alarm | background | medium | Done |
| BUG-17 | Context-menu actions are unclear and appear in irrelevant places | background/UX | medium | Done |
| BUG-15 | Captured torrent status is slow to become visible | background | medium | Done |
| BUG-16 | Interception error badge has no defined lifetime | background | medium | Done |
| BUG-14 | Context-menu sends omit working and failure toolbar states | background | medium | Done |
| BUG-13 | Toolbar repaint failure aborts the NAS hand-off | background | high | Done |
| BUG-12 | Parallel toolbar transitions lose the newer failure state | background | high | Done |
| BUG-11 | Toolbar icon updates only after a later poll or popup click | background | medium | Done |
| BUG-2 | Browser download cancelled before the NAS hand-off succeeds | background | high | Done |
| BUG-3 | Locked / empty-credential state unguarded in background | background | high | Done |
| BUG-4 | Hand-off failure swallowed by `sendAndNotify` | background | medium | Done |
| BUG-1 | Interception default flipped to `off` and persisted on read | settings | high | Done |
| BUG-9 | Service worker death between pause and cancel/resume | background | medium | Done |
| BUG-8 | No settings schema version or migration path | settings | medium | Done |
| BUG-7 | No test coverage for `handleDownloadCreated` | testing | medium | Done |
| BUG-6 | Documentation drift on interception default and modes | docs | low | Done |
| BUG-5 | `.torrent` detection gaps (fragment URLs, `filename`, `onChanged`) | background | low | Done |
| BUG-10 | Right-click send hands login-protected links to the NAS as bare URLs | background | high | Done |

---

## Cards

### BUG-34 — Seeding tasks vanish from "In progress" and obscure seeding progress/ETA metrics

**Severity:** medium · **Area:** popup/UX · **Status:** Done
**Files:** `src/lib/tasks.ts`, `src/popup/styles/tokens.css`, `src/popup/ui/ProgressBar.svelte`,
`src/popup/components/downloadItem/format.ts`, `src/popup/components/downloadItem/DownloadItem.svelte`

When a download completes and enters QNAP state 100 (`seeding`), `isInProgress()` evaluates to
false because `seeding` was previously classified under `isCompleted()`. The task immediately disappeared
from the default "In progress" popup tab, creating the perception that the download hung or failed
without result.

Live NAS investigation (2026-09-04) confirmed that QNAP Download Station V4 emits active seeding
lifecycle metrics:
- `progress`: 0–100% of the configured seeding quota (`share_time` or `share_ratio`).
- `eta`: Remaining seeding time in seconds until the quota is satisfied (e.g. 1370s for a 30m limit).
- `activity_time`: Elapsed seeding duration in seconds.
- `total_up` / `up_rate` / `share`: Uploaded volume, current speed, and actual share ratio.

Previously, `format.ts` unconditionally forced `progress` to 100% and cleared `etaText` for `seeding`
tasks, preventing users from seeing remaining seed time or seeding quota completion progress.

**Resolved 2026-09-04** —
1. `src/lib/tasks.ts`: Included `"seeding"` in `IN_PROGRESS_STATUSES` so active seeding tasks remain visible in the "In progress" tab and contribute to active task counts until quota or manual stop.
2. `src/popup/styles/tokens.css` & `src/popup/ui/ProgressBar.svelte`: Added dedicated emerald/mint design tokens (`--progress-track-seeding`, `--progress-fill-seeding`) and a `"seeding"` variant for `ProgressBar` to visually distinguish seeding quota progress from active download progress.
3. `src/popup/components/downloadItem/format.ts` & `DownloadItem.svelte`: Preserved `task.progress` and formatted seeding remaining ETA (`view.etaText`) into the status line (`• ETA: 22m 21s`).
4. Unit tests in `format.test.ts` and `downloadFilters.test.ts` verified against live NAS payload snapshots.

---

### BUG-35 — Peer and seed counts provided by NAS are never displayed in the popup

**Severity:** medium · **Area:** popup/UX · **Status:** Done
**Files:** `src/lib/tasks.ts`, `src/popup/components/downloadItem/format.ts`,
`src/popup/components/downloadItem/DownloadItem.svelte`

QNAP Download Station V4 returns `peers` and `seeds` counts for torrent tasks in `Task/Query`.
Currently, the popup displays transfer speed and ETA, but completely omits peer and seed metrics.
When a torrent is stalled or slow (0 KB/s), users cannot tell whether the swarm has 0 seeds or is
simply negotiating connections.

**Resolved 2026-09-05** —
1. `src/popup/components/downloadItem/format.ts`: Added `formatSwarm()` formatting swarm telemetry (`S 12 · P 4` for active torrents, `P 4` for seeding).
2. `src/popup/components/downloadItem/DownloadItem.svelte`: Rendered compact monospace tabular telemetry in top card row next to the task name.
3. Unit tests in `format.test.ts` and Storybook stories (`DownloadingActive`, `DownloadingStalled`, `SeedingQuota`).

---

### BUG-36 — Download payload size and progress in bytes (`done` / `size`) are hidden during download

**Severity:** medium · **Area:** popup/UX · **Status:** Done
**Files:** `src/popup/components/downloadItem/format.ts`,
`src/popup/components/downloadItem/DownloadItem.svelte`

While a task is actively downloading, `DownloadItem` displays the percentage progress bar and the
total file size, but never shows the actual downloaded volume in bytes (`done` or `down` from QNAP API).
Users cannot see "1.2 GB / 3.8 GB", which is the standard indicator in modern torrent clients
(Transmission, qBittorrent, Synology DS).

**Resolved 2026-09-05** —
1. `src/popup/components/downloadItem/format.ts`: Added `formatTaskSize()` displaying `done / size` (e.g. `16.6 GB / 22.6 GB`) for active downloads and clean total size for completed/seeding tasks.
2. `src/popup/components/downloadItem/DownloadItem.svelte`: Rendered in the secondary metadata row with monospace tabular nums.
3. Unit tests in `format.test.ts` and Storybook stories.

---

### BUG-37 — Task failure codes (`error`) from QNAP are ignored instead of displaying failure reason

**Severity:** medium · **Area:** popup/UX · **Status:** Done
**Files:** `src/lib/tasks.ts`, `src/popup/components/downloadItem/format.ts`,
`src/popup/components/downloadItem/DownloadItem.svelte`

When a task fails (QNAP state `2` / `error`), Download Station provides an integer `error` code
(e.g., duplicate hash, out of disk space, network connection timeout, invalid torrent metadata,
target path permission error). QuickGet displays only a generic red "Error" badge without detail.

**Resolved 2026-09-05** —
1. `src/lib/tasks.ts`: Extracted `errorCode` from QNAP task payload in `normalizeQnap`.
2. `src/popup/components/downloadItem/format.ts`: Created `QNAP_ERROR_MESSAGES` mapping known QNAP error integers (20488 disk full, 8196 duplicate torrent, 4096 missing destination folder, 12288-12290 network/DNS errors).
3. `src/popup/components/downloadItem/DownloadItem.svelte`: Replaced generic error with human-readable error explanation in coral text and card styling.
4. Unit tests in `format.test.ts` and Storybook stories (`ErrorDiskFull`, `ErrorDuplicate`, `ErrorFolderNotFound`).

---

### BUG-38 — Destination NAS path (`path` / `move`) is omitted from task details

**Severity:** medium · **Area:** popup/UX · **Status:** Done
**Files:** `src/lib/tasks.ts`, `src/popup/components/downloadItem/format.ts`,
`src/popup/components/downloadItem/DownloadItem.svelte`,
`src/popup/components/downloadItem/downloadItem.stories.ts`

QNAP returns destination directories `move` (final destination folder) and `temp` (temporary staging).
Users managing multi-folder setups or custom routing rules cannot see where a download was placed
directly from the popup.

**Severity raised from low on 2026-09-09.** It stopped being a details-panel nicety once routing
rules became a real feature: the destination is the *only* feedback a rule ever gives, so without
it a rule sending everything to the wrong folder looks exactly like a rule that works. That is
also why it is worth more than the notification it replaces — a toast says it once and is gone,
the card says it for as long as the task exists.

**Resolved 2026-09-09.** `Task.destination` carries `move` through normalisation, and the card
renders it as the last item of the meta row, after the ETA, with a folder icon and a `Saving to …`
tooltip carrying the full path.

Three decisions worth keeping:

- **`move`, never `path`.** `path` is where the bytes physically are and includes the task's own
  name, so it is not a folder anybody chose. When the NAS reports no `move`, the card says nothing
  rather than guessing at the default.
- **Two trailing segments, folded from the front** (`…/Documentaries/2024`). The end identifies the
  folder; the head is the same for every task. One segment loses what tells `Movies` apart from
  `Music/Movies`. Nothing is hidden — the tooltip has the whole path.
- **It is the only shrinking item in the row**, so a long path folds instead of pushing the size
  and speed off the card.

Covered by `formatDestination` unit tests, a normalisation test asserting `path` is *not* a
fallback, six Storybook stories (short, two-segment, deep, overlong, unknown, finished), and an
assertion in the full-cycle E2E.

**Prior art: none.** Not one of the three competitors shows a destination on a task card. *Send To
QNAP++* has the data and spends it on a click-to-copy absolute path and an `openfolder:\\…`
custom-protocol link that needs a helper installed; its own meta row is `ETA • ↓ • ↑ • size`. The
Synology client treats `destination` purely as a request field. See
`docs/competitor-routing-teardown.md`.

**2026-09-09, later — two corrections after looking at it in Storybook.**

- **The staging folder is shown too.** Download Station stages a task in `temp` and moves it to
  `move` on completion, so while a task runs the data is *not* where the rule sent it. The card
  reads `Download → Multimedia/Movies` until the move happens and just `Multimedia/Movies`
  afterwards — the difference between "look in Movies" and "look in Movies later". Suppressed when
  the two folders are the same.
- **It has its own line.** Inline in the meta row it was the first thing truncated away — the
  screenshot showed a folder icon and nothing after it, which is precisely the information the
  card exists to carry. One 11px row under the status line, both folders truncating
  independently.

**2026-09-09, third pass — the line only appears when it is news.** Looking at a list of cards in
Storybook, the folder row was on every one of them, and on most it said "this went where
everything goes". Two cuts, both on the product owner's call:

- **Shown only when the destination differs from the configured Target folder.** The user chose
  that folder; repeating it back on every task is noise. The card is exactly its pre-routing shape
  for the ordinary case and grows by one line precisely when a rule did something.
- **The staging folder left the card for the tooltip.** `temp` is one global setting, so on the
  card it was the same string repeated down the whole list. In the tooltip it still answers
  "where is it right now" — until the task finishes, after which naming it would point at an
  empty directory.

`defaultFolder` reaches the card as a prop from `DownloadsList`, which loads settings on mount.
Undefined means "not known yet" and shows the destination rather than guessing it away; settings
resolve long before the first NAS poll, so it is not seen in practice.

**Competitor context for the density question** (`docs/competitor-routing-teardown.md`): *Send To
QNAP++* solves it with an explicit compact/expanded toggle persisted in storage — compact hides
the whole meta row and swaps the bar for a 28px ring. It also measures that row and shrinks its
font to as low as 9px when it overflows, which is an admission that one dense row does not fit.
Hover is used there for exactly one thing, a delayed tooltip on the title. Neither of the other
two has any density control. A density toggle stays out of scope; showing less by default is the
cheaper half of the same idea.

**2026-09-09, closing the loop — and a mock that was lying about magnets.** Everything up to here
asserted what was *sent* to the NAS. Nothing asserted that the folder comes back and reaches the
user. Adding that check surfaced the reason it mattered: the mock's `AddUrl` read the `move` it
was given, validated it, and then created the task with a hardcoded `Movies` — `AddTorrent` had
always persisted both folders, `AddUrl` never had. So the one path where routing has neither a
filename nor a host of its own to work from was also the one path the harness could not tell the
truth about. Fixed, and `routing-matrix.spec.ts` now reloads the popup and asserts the magnet's
card displays the routed folder, and that a task which went to the Target shows no line at all.

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### BUG-39 — Toolbar badge background poll fetches full task list instead of lightweight `Task/Status`

**Severity:** low · **Area:** background/perf · **Status:** Backlog
**Files:** `src/background/alarms.ts`, `src/background/actions.ts`, `src/api/client.ts`

The periodic background monitoring alarm polls `/downloadstation/V4/Task/Query` with a limit of 100
tasks on every interval, fetching the entire list of tasks and all 38 fields per task just to count
active tasks for the extension badge. QNAP provides a dedicated, lightweight `/downloadstation/V4/Task/Status`
endpoint that returns summary counts directly (`total`, `downloading`, `seeding`, `paused`, `error`)
with minimal CPU and network overhead on both the browser and the NAS.

**Proposed fix:** Implement `client.getTaskStatus()` and migrate badge count monitoring to use
`Task/Status`, reserving `Task/Query` for when the popup UI is actively open.

---

### BUG-40 — Saving settings hangs on "Saving…" for >10s when NAS is unreachable or credentials invalid

**Severity:** medium · **Area:** popup/settings · **Status:** Backlog
**Files:** `src/popup/features/settings/Settings.svelte`, `src/api/index.ts`, `src/api/client.ts`

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

---

### BUG-41 — Saving routing rules with empty optional fields crashes Svelte with props_invalid_value, freezing "Add rule"

**Severity:** high · **Area:** popup/settings · **Status:** Done
**Files:** `src/popup/features/settings/Settings.svelte`, `src/popup/ui/Field.svelte`, `src/lib/routingRules.ts`

When creating or saving routing rules where optional fields (such as `domain` or `namePattern`) are left empty:
1. If `destination` is empty, `normalizeRoutingRules()` silently discards the rule without warning the user.
2. If `domain` or `namePattern` is left empty, `normalizeRoutingRules()` normalizes them to `undefined` on the reactive `form.routingRules` state.
3. Because `<Field>` defines `value = $bindable("")` with a default string fallback, binding `bind:value={rule.domain}` where `rule.domain === undefined` triggers a fatal Svelte 5 runtime exception:
   `Error: https://svelte.dev/e/props_invalid_value` (`Cannot do bind:value={undefined} when value has a fallback value`).
4. The uncaught Svelte runtime exception leaves the Routing Rules UI in a broken state; subsequent Add rule interactions no longer update the reactive state or UI.
5. Keying rules in `{#each form.routingRules as rule, i (rule)}` by object reference causes avoidable child-component remounting whenever normalization recreates rule objects. Stable draft IDs eliminate this churn.

**Resolved 2026-09-08** —
1. `src/lib/routingRules.ts`: Implemented `RoutingRuleDraft`, `toRoutingRuleDraft`, `validateRoutingRuleDraft`, and `serializeRoutingRuleDraft`. Ensured all UI draft string fields default to concrete strings (`""`), strictly preventing `undefined` values from ever reaching `<Field>` `$bindable` inputs.
2. `src/popup/features/settings/Settings.svelte`: Converted editor state to `routingRuleDrafts` with stable IDs `draft.id` (keyed in `{#each routingRuleDrafts as draft, i (draft.id)}`).
3. Replaced destructive pre-save normalization with non-destructive validation that presents inline errors and retains user drafts.
4. Added `routingRuleDrafts` to `settingsSignature` to track form dirty status reactively.
5. Playwright E2E test in `tests/e2e/routing-rules.spec.ts` verified with `expect(pageErrors).toEqual([])` and active interactivity.

---

### BUG-42 — Routing rules parser edge cases: case-sensitive .torrent, fragile magnet dn parsing, unhandled URI errors, and domain normalization

**Severity:** high · **Area:** core/routing · **Status:** Done
**Files:** `src/lib/routingRules.ts`, `src/lib/routingRules.test.ts`

Audit of `src/lib/routingRules.ts` revealed silent routing failures and unhandled runtime exceptions:
1. **Case-sensitive extension in `classifyUrl`:** `stripQueryAndHash(url).endsWith(".torrent")` is case-sensitive and misses `.TORRENT` or `.Torrent`. Similarly, `MAGNET:` scheme should be handled case-insensitively.
2. **Fragile `magnet dn=` parsing in `getFilename`:** `param.split("=")` splits on the first `=` only, dropping content if the filename contains `=` (e.g., base64 chunks or titles with `=`). It also manually re-implements percent decoding and `+` replacement instead of using standard `URLSearchParams`.
3. **Double `decodeURIComponent` exception in `getFilename`:** If a URL is syntactically valid but contains a malformed percent-sequence (e.g., `foo%ZZ.mkv`), `decodeURIComponent` throws `URIError`. The `catch` block attempts `decodeURIComponent(lastSegment)` a second time *outside* a try-catch, causing an unhandled crash. Safe fallback should return the raw segment.
4. **Sanitizer vs Resolver semantic mismatch:** `sanitizeRoutingRules` allows whitespace-only `destination: "   "`, but `resolveDestination` skips it because `rule.destination.trim() === ""`.
5. **Empty string conditions in storage:** If a rule has `domain: ""` or `namePattern: ""` in storage, `resolveDestination` checks `rule.domain !== undefined` or `rule.namePattern !== undefined`, treating an empty string as an active impossible condition (e.g. `/^$/`) that can never match.
6. **Domain matching edge cases:** Domains pasted with protocol (`https://example.com`), trailing slashes (`example.com/`), or trailing dots (`example.com.`) fail to match incoming URLs.
7. **Condition policy:** A rule requires at least one condition (`type !== "all" || domain.trim() || namePattern.trim()`) AND a non-empty `destination.trim()`. Catch-all rules without conditions are prohibited in the UI (users configure the global Target folder setting instead).

**Resolved 2026-09-08** —
1. `src/lib/routingRules.ts`: Switched magnet query parsing in `getFilename` to `URLSearchParams`, correctly preserving `=` in filenames and decoding pluses.
2. Added `safeDecodeURIComponent` fallback to return raw string without throwing `URIError`.
3. Added `normalizeDomain` stripping `https?://`, trailing slashes, dots, and lowercasing.
4. Hardened `classifyUrl` to handle uppercase `.TORRENT` and `magnet:` case-insensitively.
5. In `sanitizeRoutingRules`, trimmed empty strings to `undefined` and discarded whitespace-only destinations.
6. Consolidated all 8 edge cases into passing assertions in `src/lib/routingRules.test.ts`.

---

### BUG-43 — Routing rules UX in popup: cramped single-line layout, missing priority reorder controls, and silent rule drop

**Severity:** high · **Area:** popup/UX · **Status:** Done
**Files:** `src/popup/features/settings/Settings.svelte`, `src/popup/features/folderPicker/FolderSelect.svelte`

The previous Routing Rules interface in the popup (~360–400px width) had critical usability issues:
1. **Cramped horizontal layout:** Three inputs (`Select` type, `Field` filename, `Field` domain) were squeezed into a single row alongside the delete button.
2. **No priority reordering:** The rule engine operates on "First matching rule wins", but the UI provided no way to reorder rules (no Move Up / Move Down buttons).
3. **Ambiguous condition logic:** Users could not tell whether conditions are combined with AND or OR.
4. **Data loss on incomplete rules:** Clicking "Save" when `destination` was blank silently dropped the rule without user confirmation or validation error.
5. **Incompatible conditions (Magnet + Domain):** Selecting type `magnet` while filling `domain` created an impossible condition (magnets have no host).

**Resolved 2026-09-08** —
1. `src/popup/features/settings/Settings.svelte`: Implemented vertical card layout (`IF ... THEN SAVE TO`) with `Rule N` header, microcopy `matches all filled (AND)`, and full-width `FolderSelect`.
2. Added accessible Move Up / Move Down icon buttons with boundary disable logic (`i === 0` and `i === length - 1`), plus Remove button with destructive hover tone.
3. Added transactional validation: incomplete destination or empty conditions render inline `role="alert"` errors, focus the invalid field, and never drop rows.
4. When `type === "magnet"`, disabled Domain field with hint *"Domain matching is not applicable to magnet links"* and cleared domain upon serialization.
5. Verified with Playwright E2E tests in `tests/e2e/routing-rules.spec.ts` and Storybook stories.

---

### BUG-44 — Comprehensive regression coverage & post-fix test suite for Routing Rules

**Severity:** high · **Area:** testing · **Status:** Done
**Files:** `src/lib/routingRules.test.ts`, `tests/e2e/routing-rules.spec.ts`, `tests/e2e/fixtures/test-stand/index.html`, `src/popup/features/settings/RoutingRules.stories.ts`

Comprehensive test suite covering unit, component, Storybook, and E2E regression:
1. `src/lib/routingRules.test.ts`: Consolidated 34 unit tests covering URL/magnet edge cases, draft conversions, draft validation, and domain normalization (all 379 test suite cases passing).
2. `src/popup/features/settings/RoutingRules.stories.ts`: Added 8 dedicated Storybook stories (`EmptyState`, `SingleRule`, `MultiplePrioritizedRules`, `MagnetDisabledDomain`, `ValidationErrorMissingDestination`, `ValidationErrorNoConditions`, `ReorderPriorityInteraction`, `LongPatternsAndDeepPaths`).
3. `tests/e2e/fixtures/test-stand/index.html`: Created interactive test stand with Torrents, Magnets, Direct URLs, and Domains tabs, including live event logger and download triggers.
4. `tests/e2e/routing-rules.spec.ts`: Expanded Playwright suite to 5 tests verifying zero page errors, draft retention on validation error, priority reordering persistence, and live interception against mock NAS with routed destinations.

**Resolved 2026-09-08** —
All test suites green and verified via CI quality gates.


**2026-09-09 — the coverage it added had a blind spot, now closed.** The stand's host served one
shared `sample.torrent` for every `.torrent` link, so all four torrent cards were byte-identical
inside and no test could tell whether routing used the URL or the file. The host now generates a
distinct torrent per link, a "Tracker endpoints" tab carries the shapes a real private tracker
produces (opaque `dl.php`, MIME-only with no filename, multi-file pack, second hostname, magnet
with no `dn`, v2 magnet), and `tests/e2e/routing-matrix.spec.ts` asserts the destination folder
for all twelve. The full picture, including what the stand still cannot reach, is
`docs/routing-coverage.md`.

---

### BUG-45 — Routing engine ReDoS vulnerability in matchGlob, sanitizer condition-invariant gap, and type: "all" draft smell

**Severity:** high · **Area:** core/routing · **Status:** Done
**Files:** `src/lib/routingRules.ts`, `src/lib/routingRules.test.ts`, `src/popup/features/settings/Settings.svelte`,
`src/popup/features/settings/RoutingRules.stories.ts`, `tests/e2e/routing-rules.spec.ts`

Following architecture review via ChatGPT Gateway on `ca198bd`, two critical production blockers and an architectural typing smell were identified and resolved:
1. **ReDoS / Catastrophic Backtracking in `matchGlob`:**
   Converting wildcard glob patterns like `*a*a*a*...b` into regular expressions (`^.*a.*a.*a...b$`) induces exponential backtracking in V8. Under Chrome MV3, an adversarial or accidental glob pattern locks up the service worker or UI thread.
   *Competitor benchmark:* Leading download routing extensions (e.g. *Downloads Butler*, *SmarTidy Downloader*, *Regexp Download Organizer*) either avoid regular expressions for glob matching or constrain pattern execution. Replaced `new RegExp()` with a deterministic, linear two-pointer wildcard matching algorithm ($\mathcal{O}(|s| \times |p|)$) supporting `*` and `?`, case-insensitive, with literal treatment of regex special characters (`[]()+${}^`).
2. **Sanitizer Invariant Mismatch (Catch-all shadow rules):**
   The UI validator strictly mandates `destination` plus at least one active condition (`type !== "all" || domain || namePattern`). However, `sanitizeRoutingRules` previously accepted rules with only `destination: "Folder"`, which `resolveDestination` evaluated as matching *all* inputs. If such a rule were positioned first, all subsequent rules were permanently shadowed. Furthermore, magnet rules erroneously retained `domain` conditions in storage despite magnets lacking HTTP hosts.
   *Resolution:* Aligned `sanitizeRoutingRules` to discard rules lacking active conditions and strip invalid domain conditions from magnet rules.
3. **`type: "all"` vs `undefined` Typing Smell:**
   `RoutingRuleDraft.type` was previously typed as `RoutingMatchType | undefined`, allowing `undefined` bindings to creep into Svelte 5 `<Select>` inputs and triggering semantic ambiguities in condition evaluation (`Boolean(draft.type)`).
   *Resolution:* Introduced concrete `type RoutingRuleDraftType = "all" | RoutingMatchType;` so `draft.type` is always a concrete string. On serialization, `"all"` is cleanly omitted from storage.
4. **Test Suite Expansion:**
   - Vitest: Added ReDoS verification test executing 16-group adversarial wildcard pattern in <5ms, regex literal characters test, sanitizer catch-all prevention tests, and draft roundtrip tests.
   - Playwright E2E: Added cold hydration reload test (`reloading popup loads stored rules without errors and maintains full draft reactivity`) and transactional validation assertion confirming `chrome.storage.local` remains untouched upon validation errors.
   - Storybook: Added `play` assertions for disabled `Move Up` / `Move Down` controls on single and multi-rule configurations.

**Resolved 2026-09-09** —
All 385 Vitest unit tests, Storybook build, and 31 Playwright E2E tests verified green.

---

### BUG-46 — Routing type detection disagrees with the send-path detector, so `.torrent` rules miss tracker links

**Severity:** high · **Area:** core/routing · **Status:** Done
**Files:** `src/lib/routingRules.ts` (`classifyUrl`), `src/background/menus.ts:78`,
`src/background/downloads.ts:293`, `src/background/magnetHandler.ts:32`, `src/lib/torrentSender.ts:25`

Two detectors answer the same question and disagree. `isTorrentSource(url, mime, filename)`
uses four signals — response MIME, the `Content-Disposition` filename, a `.torrent` ending, and
the `/dl.php` fallback. `classifyUrl(url)` uses one: does the URL end in `.torrent`.

They are called side by side. In `menus.ts` the destination is resolved with
`classifyUrl(url)` on line 78 and the transport is chosen with `isTorrentSource(url)` on line
83. In `downloads.ts` the type is already established on line 66 from `item.mime` and
`item.filename`, then thrown away and re-derived from the bare URL on line 293.

The consequence lands exactly on the case the interception path exists for. A private tracker
serves `https://tracker/dl.php?id=12345`: the extension correctly treats it as a torrent and
uploads the file via `AddTorrent`, while the routing engine classifies it as `url`. A rule
"type = .torrent → Multimedia/Torrents" never fires on the links that need it most, and the
user has no way to tell why.

**Fix:** `RoutingInput.kind` already exists as a parameter — callers must supply the truth they
already hold instead of asking a weaker function to guess it again. `classifyUrl` stays as the
fallback for `magnetHandler`, which genuinely has nothing but the URI.

**Acceptance criteria**

- [x] `menus.ts` and `downloads.ts` pass the kind their own torrent detection produced.
- [x] A rule with `type: "torrent"` matches `https://tracker/dl.php?id=1` whenever the
      extension itself sends that link as a torrent.
- [x] `classifyUrl` is documented and unit-covered as a fallback, not as the classifier.
- [x] A test asserts the two paths cannot diverge for the same input plus metadata.


**2026-09-09 — fixed. **Done 2026-09-09**,** `classifySource(url, mime?, filename?)` in
`src/lib/torrentSender.ts` is now the single answer: magnet by scheme, otherwise whatever
`isTorrentSource` says. `menus.ts` classifies once and branches the transport on the *same*
value, so the two cannot disagree; `downloads.ts` states `kind: "torrent"` outright, because
that path only runs for torrents. A test walks the signal matrix and asserts `classifySource`
never contradicts `isTorrentSource`.

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### BUG-47 — Rules match the URL slug instead of the name the download will actually have

**Severity:** high · **Area:** core/routing · **Status:** Done
**Files:** `src/lib/routingRules.ts` (`getFilename`), `src/background/downloads.ts:66,293`,
`src/lib/torrentSender.ts:52` (`sendTorrentUrlToNas`)

`getFilename` returns whatever the URL happens to end with:

| Source | What the matcher sees | What the user means |
|---|---|---|
| magnet | the `dn` parameter, which has no extension and is often absent | the release name |
| `.torrent` URL | `1234.torrent`, `download.php` | the name of the content inside |
| direct HTTP | the real filename | the real filename ✅ |

The editor's placeholder is `e.g. *.mkv` for every type, so it actively teaches a pattern that
can never match a torrent. This is the defect behind the whole "the rules do not work on
torrents" complaint.

**Two better sources already exist in the code and are both discarded:**

1. `DownloadItem.filename` — Chrome has already derived it from `Content-Disposition`, and
   `downloads.ts:66` reads it to decide the link *is* a torrent. It is the only meaningful name
   a `dl.php?id=…` link has.
2. **The `.torrent` bytes themselves.** `sendTorrentUrlToNas` fetches the blob and already
   inspects its first two bytes to confirm it is bencoded (`assertLooksLikeTorrent`). The info
   dictionary's `name` key is the real content name — a bounded scan for `4:name` needs no
   dependency and no NAS call. This requires splitting fetch from send so the destination is
   resolved *after* the name is known; today the folder is computed before the fetch and passed
   in.

Magnets have no equivalent: the content name is only knowable after the NAS resolves metadata.
See GAP-14 / RES-6 on the competitive-gaps board for whether that window can be used at all.

**Acceptance criteria**

- [x] `RoutingInput` carries an explicit name candidate; the resolver stops re-deriving one
      from the URL.
- [x] Intercepted downloads pass `DownloadItem.filename` whenever Chrome has produced one.
- [x] A `.torrent` hand-off resolves against the info-dict `name`, so `*.mkv` matches a
      single-file torrent whose URL ends in `.torrent`.
- [x] The bencode reader is bounded (size cap, malformed input rejected) and unit-covered
      against a real single-file and multi-file torrent.
- [ ] Magnet keeps `dn` as its only source; an absent `dn` is distinguishable from an empty
      match rather than silently failing every pattern rule.


**2026-09-09 — fixed. **Done 2026-09-09**,** Three changes:
- `RoutingInput` gained `name?`, and `getFilename` prefers it over anything derived from the URL.
- `src/lib/torrentMeta.ts` — `readTorrentName(bytes)` reads `info.name` (and `name.utf-8`) out of
  the `.torrent` with a bounded, structural walk that skips `pieces` rather than copying it.
  Malformed or oversized input returns `undefined`. 12 unit tests, including a decoy `4:name`
  planted inside both a comment and the `pieces` blob — the case a naive scan gets wrong.
- `sendTorrentUrlToNas` now accepts a function for `folder`, called with that name once the file
  has been fetched, so the destination is decided against the release rather than the URL.
  `downloads.ts` additionally passes `DownloadItem.filename` as the fallback candidate.

The remaining acceptance line — telling the user when a magnet has no `dn` to match on — is not a
matcher concern and moved to UX-18/UX-19.

**Prior art, checked 2026-09-09:** no competitor does this. *Send To QNAP++* has an equivalent
bencode parser and uses the name only to correlate a NAS task back to its source URL; its matcher
still gets the URL. See `docs/competitor-routing-teardown.md` section B.

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### BUG-48 — Rule condition errors are not tied to the fields they describe

**Severity:** high · **Area:** popup/a11y · **Status:** Done
**Files:** `src/popup/features/settings/Settings.svelte:769`, `src/popup/ui/Field.svelte`

`Field` already implements the correct behaviour — an `error` prop sets `aria-invalid`, renders
the message with a generated id and points `aria-describedby` at it. That is what UX-1 shipped
it for, and `FolderSelect` uses it for the destination side of each rule.

The IF side does not. Both condition inputs are rendered with only an `aria-label`, and the
condition error is a loose `<p role="alert">` next to them (`:769`). A screen-reader user
standing in the pattern field is told neither that it is invalid nor what is wrong with it —
the exact failure mode `tests/e2e/a11y.spec.ts` was written to prevent for the connection
fields.

**Acceptance criteria**

- [x] The condition error is passed to the fields it concerns via `Field`'s `error` prop.
- [x] The offending inputs carry `aria-invalid="true"` and an `aria-describedby` that resolves
      to the message.
- [x] One alert per card, not one per field plus a loose paragraph.
- [x] E2E asserts this on a rule field the way the existing spec asserts it on `#NASlogin`.


**2026-09-09 — fixed. **Done 2026-09-09**,** The condition error is passed to the name `Field`, which
renders it with the `aria-invalid` / `aria-describedby` / `role="alert"` wiring it already had;
the type `Select` and the domain `Field` carry `aria-invalid` and point at the same message id.
The loose `<p role="alert">` is gone, so there is one alert per card. Covered by the new axe pass
over a rejected rule (BUG-51).

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### BUG-49 — Reordering a rule drops keyboard focus and announces nothing

**Severity:** medium · **Area:** popup/a11y · **Status:** Done
**Files:** `src/popup/features/settings/Settings.svelte:216-232` (`moveRuleUp` / `moveRuleDown`),
`:694-710`

Moving a rule to the first position disables the Move Up button that currently has focus, and
Chrome drops focus to `<body>`. A keyboard user is thrown to the top of the document after one
keypress, mid-task.

Nothing is announced either. Priority order *is* the semantics of this feature — first match
wins — and changing it is completely silent, while removing a rule does post to the live region
(`:213`). The two actions should not differ.

**Acceptance criteria**

- [x] After a move, focus is on a control inside the rule that moved.
- [x] The live region says what moved and where it landed ("Rule 2 moved up — now rule 1").
- [x] Covered by a keyboard-only E2E, not a mouse-driven one.


**2026-09-09 — fixed. **Done 2026-09-09**,** `moveRuleUp`/`moveRuleDown` collapsed into `moveRule(index,
delta)`, which announces the move through the existing live region and then restores focus: the
button that performed it when it is still enabled, its sibling when the rule has reached an end.
The Move controls gained ids so focus can find them. A keyboard-only E2E asserts focus stays
inside the rule that moved and that the announcement fires.

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### BUG-50 — Rule card small print fails contrast and lowercases the AND it exists to explain

**Severity:** medium · **Area:** popup/a11y · **Status:** Done
**Files:** `src/popup/features/settings/Settings.svelte:726`, `src/popup/ui/IconButton.svelte`

`:726` renders "matches all filled (AND)" at `text-10px` with `opacity-75` on
`--text-secondary`. In the light theme that is `#526276` at 75% over `--color-bg-alt`
`#eef1f6` — roughly **3.6:1** against the 4.5:1 required for text this size. Recompute rather
than trust that figure, and check dark as well.

It is not decorative text. It is the only place the editor explains that conditions combine
with AND, and the same element carries `lowercase`, which renders the "AND" as "and" and
removes the one word doing the work.

Separately, `IconButton` uses `disabled:opacity-45`; disabled controls are exempt from the
contrast requirement, but at 45% the Move Up/Down arrows read as absent rather than disabled.

**Acceptance criteria**

- [x] Contrast measured in both themes and at or above 4.5:1 for every text node in the card.
- [x] Smallest text in the rule card is at least 11px.
- [x] The AND semantics survives the styling — uppercase kept, or stated in words.
- [x] axe reports no `color-contrast` violation with the Advanced tab open (needs BUG-51).


**2026-09-09 — fixed. **Done 2026-09-09**,** The hint is now 11px with no `opacity`, inheriting
`--text-secondary`: 5.6:1 in light, 8.6:1 in dark, both above 4.5:1. It reads "all filled
conditions must match" — the AND is stated in words rather than shouted and then lowercased by a
stray utility class. `IconButton`'s `disabled:opacity-45` was deliberately left alone: it is a
shared control, disabled elements are exempt from the contrast requirement, and changing it here
would be a global restyle smuggled into a routing fix.

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### BUG-51 — The axe gate never reaches the routing rules UI

**Severity:** medium · **Area:** testing · **Status:** Done
**Files:** `tests/e2e/a11y.spec.ts`, `src/popup/ui/Tabs.svelte:58`

The spec seeds two `routingRules` into storage, which looks like coverage, but it only ever
opens the Connection tab. `Tabs` renders inactive panels with the `hidden` attribute (`:58`),
and axe skips hidden subtrees entirely — so the rule cards have never been scanned by the gate
that UX-9 marked Done. That is how BUG-48 and BUG-50 shipped.

**Acceptance criteria**

- [x] The axe pass switches to Advanced and scans with at least one rule rendered.
- [x] It scans a rule in an error state as well as a valid one.
- [x] `RoutingRules.stories.ts` states are covered by the Storybook a11y run.
- [x] Adding a tab in future does not silently drop it from the sweep — the spec iterates the
      tabs rather than naming one.


**2026-09-09 — fixed. **Done 2026-09-09**,** `tests/e2e/a11y.spec.ts` gained a pass that switches to the
Advanced tab and scans the rule cards twice — once valid, once after a rejected save, which is
the markup BUG-48 was about. The Storybook magnet story now also asserts the domain field's
`aria-describedby`, so the explanation stays connected to the field it explains.

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### BUG-52 — Delete sits next to the reorder arrows and looks identical to them

**Severity:** low · **Area:** popup/UX · **Status:** Done
**Files:** `src/popup/features/settings/Settings.svelte` (rule header, `:715-745`)

**Rescoped twice; this is the version that treats the actual cause.** It began as "choosing Magnet
erases the typed domain" (fixed), became "no way to discard unsaved rule edits", and is now the
thing that makes discarding necessary in the first place.

Each rule's header ends with three 28×28 icon buttons, 4px apart: `↑`, `↓`, `✕`. The only
destructive control on the screen is the same size and shape as the two harmless ones, and it sits
immediately after the one you press repeatedly. Reordering a rule and deleting it are 32 pixels
apart.

Recovery afterwards is poor and that is the point — it is why prevention is the right fix. The
toast says "Rule 3 removed" and carries no Undo; `showStatus` cannot hold a control (the same
infrastructure gap that defers GAP-4). Closing the settings *panel* does not help: `togglePanel`
toggles a CSS class, the component stays mounted and the drafts survive. Only closing the whole
popup discards them — along with every other unsaved change in the form.

**Fix:** separate the destructive control from the navigational ones. `✕` at the other end of the
header, or the arrows grouped and `✕` set apart by a real gap. Minutes, no new state.

**Heavier alternatives, deliberately not chosen now**

- *Undo on the toast* — the precise fix for "I deleted it by mistake", and it needs a toast that
  can carry an action. If that infrastructure ever lands for GAP-4, this closes with it.
- *A Discard button in the footer* — treats the wrong illness. The problem is one lost rule; this
  throws away deliberate edits too.

**Acceptance criteria**

- [x] The delete control is not adjacent to the reorder controls, and reads as destructive.
- [x] Keyboard order still puts the rule's own controls together, and the Storybook stories cover
      the new layout.
- [x] No confirmation dialog — a per-delete prompt on a five-item list is worse than the mis-click.

**2026-09-09 — fixed, In Review.** The two reorder arrows are their own group; the delete control
sits apart from them by `--space-3` at the end of the header. No confirmation dialog, no new state,
no Discard button. The heavier alternatives above stay recorded for whenever a toast can carry an
action.

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### BUG-53 — Rule editor a11y polish batch: focus, labels, dead class, literal caps

**Severity:** low · **Area:** popup/a11y · **Status:** Done
**Files:** `src/popup/features/settings/Settings.svelte:688,725,746,760-768,778`

Small items, each cheap, grouped so they are not five cards:

- **Add rule moves nothing.** The new card appears at the bottom of the list, focus stays on
  the button, and nothing is announced — indistinguishable from a no-op without sight.
- **The disabled Domain field cannot explain itself.** `disabled` removes it from the tab
  order, and the sentence that says why (`:766`) is not connected by `aria-describedby`, so
  assistive tech never encounters either.
- **Duplicate rule name.** `<legend class="sr-only">Rule N</legend>` (`:688`) sits next to a
  visible `Rule N` span, so the group announces its name twice.
- **`visually-hidden` is a dead class** — not a UnoCSS utility; only the `sr-only` beside it
  does anything. Remove it or the next reader will assume it works.
- **Literal capitals.** "IF" (`:725`) and "THEN SAVE TO" (`:778`) are uppercase in the source
  *and* carry the `uppercase` class. Write them in sentence case and let CSS do the shouting,
  so a screen reader does not spell out a two-letter word as an abbreviation.
- **No visible labels at all** — the three condition controls are identified by placeholder
  only, which disappears on input. The column-header fix belongs to UX-18.

**Acceptance criteria**

- [x] Adding a rule focuses the new card's first control and announces it.
- [x] The magnet/domain limitation is reachable by assistive tech.
- [x] Each rule group announces its name once.
- [x] No dead utility classes; no literal uppercase carrying meaning.


**2026-09-09 — fixed. **Done 2026-09-09**,** Adding a rule now focuses the new card's type control and
announces itself. The magnet note carries an id and is referenced by the domain field's
`aria-describedby`, and it says what actually happens now ("kept but not applied"). The visible
`Rule N` span is `aria-hidden`, leaving the `<legend>` as the group's only name. The dead
`visually-hidden` class is gone. "IF" / "THEN SAVE TO" are written "If" / "Then save to" with the
shouting left to the existing `uppercase` class.

Not included: visible column labels for the three condition controls. That is UX-18, which
redesigns the header row rather than adding three labels to the current layout.

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### BUG-54 — Popup `.torrent` upload bypasses routing rules entirely

**Severity:** medium · **Area:** popup/upload · **Status:** Done
**Files:** `src/popup/features/upload/torrentUpload.ts:21`, `src/api/client.ts` (`addTorrent`)

`uploadTorrent` calls `client.addTorrent(file)` with no folder, so the destination is
`settings.NASdir` and nothing else. A user with "season packs → TV" configured drags a `.torrent`
into the popup and it lands in the default folder, silently — the same rule that works when the
identical file is clicked on the tracker.

The file is already a `File` in hand, so `readTorrentName` applies directly and the fix is the one
already made for the interception path: read the name, resolve the destination, pass it down.
`addTorrent` takes no folder argument today and would need one — `sendTorrentUrlToNas` fakes it by
overriding `settings.NASdir`, which is not a pattern to copy into a second place.

Worth knowing: *Send To QNAP++* has exactly this bug, from exactly the same cause — routing lives
at one choke point and the `AddTorrent` path does not go through it
(`docs/competitor-routing-teardown.md` section E).

**Acceptance criteria**

- [x] A `.torrent` uploaded through the popup lands in the folder its rule names.
- [x] `addTorrent` takes the destination as an argument rather than through a mutated settings copy.
- [ ] The matrix spec gains a row for this path (`docs/routing-coverage.md`).
- [x] Quick-add's explicit folder picker still wins over rules — that bypass is deliberate.

**2026-09-09 — fixed. **Done 2026-09-09**,** `uploadTorrent` reads the file's own `info.name` and resolves
the destination like every other send path; `addTorrent(file, { targetFolder })` takes it as an
argument, which also removed the `{...settings, NASdir: folder}` spread that `sendTorrentUrlToNas`
was using to fake the same thing. Unit-covered.

The matrix row stays unticked on purpose: the popup's hidden file input is not something the test
stand can drive, and adding a seam for it would cost more than the assertion is worth. Recorded in
the "cannot cover" table in `docs/routing-coverage.md` instead.

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### BUG-55 — Routing edge cases have no test at the level that can reach them

**Severity:** low · **Area:** testing · **Status:** Backlog
**Files:** `src/background/menus.test.ts`, `tests/e2e/routing-matrix.spec.ts`

**Written first as "the context-menu path has no coverage", which is wrong — corrected the same
day after reading `menus.test.ts`.** `handleContextMenuClick` is exported and unit-tested through
MSW, including *"routes the fetched torrent to the folder its rule selects"*, which asserts the
`move` field out of the multipart body. The context-menu path is covered where it can be covered
cheaply; what is missing is only Chrome's real menu wiring, and that needs a test seam in a
production build to reach. Not worth it.

What is actually uncovered is a handful of edge cases, all of which fit in the existing unit
suite with no new machinery:

- **quick-add is *supposed* to bypass rules** — nothing asserts it, so a future change could
  quietly make it obey them and nobody would notice until a user's explicit folder choice stopped
  winning.
- **a valid-MIME torrent whose bencode is unreadable**, falling back to `DownloadItem.filename`
  (`readTorrentName` returns `undefined` — unit-covered in isolation, never through a send).

**Acceptance criteria**

- [x] The two cases above are asserted at the unit level, on the destination folder rather than
      on success.
- [x] `docs/routing-coverage.md`'s "cannot cover" table drops the rows these close, and keeps
      Chrome's native menu with the reason it stays out.
- [ ] No test seam is added to production code for this.

**2026-09-09 — trimmed from four cases to two.** Dropped: the non-ASCII name, already covered in
`torrentMeta.test.ts` at the level that actually parses it; and the successful login-walled fetch,
because `hotlink-guard.spec.ts` proves the fetch and the folder is chosen by exactly the same code
as every other torrent send. What is left is the two that guard something nothing else does — a
deliberate bypass that a future "fix" could silently remove, and a fallback path never exercised
through a real send.

**2026-09-09 — fixed, In Review.** Both cases assert the destination folder, not merely success:

- `menus.test.ts` — an unreadable `.torrent` on the context-menu path degrades to the URL's own
  name, which for a `.torrent` link names the metadata file. The test asserts it lands in the
  `torrent` rule rather than the `mkv` one, so the limit is written down instead of rediscovered.
- `downloads.test.ts` — the interception path *does* have a name to fall back to, the one Chrome
  derived from `Content-Disposition`, and a `dl.php` download with an unreadable torrent still
  routes on it.

Quick-add's deliberate bypass is left unasserted after all: `CreateUrls.svelte` contains no
rule-resolution code, so a test there would restate that it passes its own folder and would not
catch the regression the card feared.

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### BUG-56 — The test stand advertises cases it cannot exercise

**Severity:** low · **Area:** testing · **Status:** Done
**Files:** `tests/e2e/fixtures/test-stand/index.html` (tabs "Direct downloads", "Domains & Edge Cases")

Two groups of cards on the stand imply coverage that does not exist:

- **Domains & Edge Cases** links to `https://tracker.example.com/...` and
  `https://eu-west.cdn-network.org/...`, which resolve nowhere. Clicking them in the harness does
  nothing; clicking them manually gives a DNS error. Domain matching is now genuinely covered by
  the second-hostname card on the Tracker tab, so these are pure decoration.
- **Direct downloads** cards carry rule hints like "Pattern `*.mkv` → Movies", but a plain HTTP
  download is never intercepted, so no rule can fire. The stand teaches the opposite of what the
  product does.

Either wire them to something real or relabel them as "not intercepted — this is what a rule
cannot do". The second is arguably more useful: the stand is where someone goes to find out what
the feature does.

**Acceptance criteria**

- [x] No card on the stand implies behaviour the extension does not have.
- [x] Every card is either driven by the matrix spec or explicitly marked as a manual/negative case.
- [x] `docs/routing-coverage.md` and the stand agree.

**2026-09-09 — fixed. **Done 2026-09-09**,** The two links to hosts that resolve nowhere are deleted; domain
matching is demonstrated for real on the Tracker tab, twice. The "Direct downloads" tab and what
is now "URL edge cases" both open with "nothing on this tab reaches the NAS", and every card there
says which rule *cannot* fire rather than which one would. Those cards are worth keeping: the
stand is where someone goes to find out what the feature does, and the edge of a feature is part
of what it does.

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### BUG-57 — A wildcard-only pattern is a catch-all the sanitizer was written to prevent

**Severity:** medium · **Area:** core/routing · **Status:** Rejected
**Files:** `src/lib/routingRules.ts` (`sanitizeRoutingRules`, `validateRoutingRuleDraft`)

`sanitizeRoutingRules` documents an invariant — "catch-all rules without conditions are
prohibited, unmatched downloads use the global Target" — and enforces it by requiring one of
`type`, `domain`, `namePattern` to be set. A rule whose only condition is `namePattern: "*"`
satisfies that check and then matches everything. Put first, it shadows the entire list, and
because rules fail silently the user sees "all my downloads go to one folder" with no clue why.

The same is true of `*` mixed into a list (`mkv *` matches everything) now that a field holds
several values.

**Why it is easy:** the guard is one predicate next to the ones already there — a pattern whose
every token is made only of `*` and `?` carries no information, so treat it as absent. If nothing
else is set, the rule is condition-less and already gets dropped. The editor's validator says the
same thing, from the same function.

**Do not over-fit.** `*.mkv`, `*S01*` and `*` mixed with a real domain are all legitimate. This is
only about a rule that constrains nothing.

**Acceptance criteria**

- [ ] A rule whose only condition is a wildcard-only pattern is dropped by the sanitizer and
      rejected by the editor, with a message naming the reason.
- [ ] `*` alongside a domain or a type still works — it is not a catch-all then.
- [ ] Existing stored rules that are catch-alls are dropped on load rather than silently kept.
- [ ] Unit-covered both ways, including `mkv *` in one field.

**2026-09-09 — Rejected the day after it was written.** Two reasons, and the second is the one
that decides it.

**It polices intent, not data.** The sanitizer exists to reject malformed input from storage and
imported backups — a rule with *no conditions at all*, which nobody typed and which shadows
everything. A pattern of `*` is a condition the user wrote on purpose. Ordering is theirs to
choose, "first match wins" is stated in the editor, and the rule list is short and visible.

**The failure is now self-diagnosing.** Since BUG-38 every task card shows the folder it is going
to. A stray `*` at the top of the list announces itself on the next download instead of hiding.

Left in the code instead of a guard: a sentence in `sanitizeRoutingRules` saying a wildcard-only
pattern passes deliberately, so the next reader does not file this card again.

---

### BUG-33 — Torrent interception starts before a live NAS connection is established

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts`, `src/background/downloads.test.ts`,
`tests/e2e/download-interception.spec.ts`

A complete configuration was treated as sufficient permission to begin interception. The
extension could therefore hold or pause the Chrome transfer and fetch the `.torrent` before it
discovered during `AddTorrent` login that the NAS was offline. Although the transactional path
later resumed Chrome, the download had already been intercepted temporarily; strict no-file mode
could cancel it before learning that the NAS was unreachable.

**Resolved 2026-08-31** — every candidate now performs a live NAS login before QuickGet fetches
the torrent or calls any Chrome transfer mutation (`pause`, `cancel`, `resume`, or `erase`). A
failed preflight releases the filename hold immediately and leaves the original download entirely
to Chrome. The decision is never based on persisted connection health. Unit coverage exercises
both normal and no-local-file modes and proves that a failed preflight performs no tracker fetch
and no download mutation.

---

### BUG-32 — Optimistic toolbar paint left dangling references after the badge refactor

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/menus.ts`, `src/background/actions.test.ts`,
`src/background/alarms.test.ts`, `src/background/downloads.test.ts`,
`src/background/menus.test.ts`, `tests/e2e/download-interception.spec.ts`

The badge refactor that removed idle hysteresis (`zeroStreak`/`firstZeroAt`) and the failure
budget (`errorStreak`/`ERROR_LIMIT`) deleted `markInterceptionStarted()` and
`noteMonitoringFailure()` from `actions.ts`, but `menus.ts` still imported and called the
former. Every context-menu send therefore threw
`markInterceptionStarted is not a function` and showed "Failed to send with QuickGet" —
the primary "Send to QuickGet" path was broken, not merely mistyped. `tsc` reported 4 errors
and 23 unit tests failed.

**Resolved 2026-08-31** — `menus.ts` no longer paints an optimistic active state; it relies on
`ensureMonitoring()` exactly like the interception path in `downloads.ts`. Tests asserting the
removed behaviour were retargeted at what the code now guarantees rather than deleted wholesale:
a single successful zero is authoritative, a failed query flags the toolbar at once, and
write-coalescing (`["1","2","1",""]`) is still gated. The E2E restart test waited on the
title `"Sending torrent to QNAP…"` that nothing sets any more, which timed out and let the
download retry — masking BUG-31's real assertions behind 4 `AddTorrent` calls instead of 1.
It now waits on the hand-off itself and proves both the single upload and the erased
`DownloadItem`.

---

### BUG-31 — Successful torrent hand-offs retain a Chrome DownloadItem after restart

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts`, `src/background/downloads.test.ts`,
`tests/e2e/download-interception.spec.ts`

After Download Station accepts an intercepted `.torrent`, the extension cancels the matching
Chrome transfer but intentionally leaves its `DownloadItem` in Chrome's history. A real Chromium
profile test closes and reopens the browser, then receives that same record again (`id: 1`,
`state: "complete"`, original `.torrent` URL). The current run does **not** make a second
`AddTorrent` request, so persistence is proven but automatic NAS replay is not yet reproduced.

The source code explicitly chose this behaviour: `cancelBrowserDownload()` says it keeps a
cancelled download in Chrome's list to offer the user Retry. The E2E result shows the overlooked
fast-download case: the source can already be `complete` before cancel, yet its history entry is
still retained across a browser restart.

**Decision taken:** do not mutate the browser download before `AddTorrent` succeeds; after
success, erase its terminal `DownloadItem`.
Chrome documents that `chrome.downloads.erase({ id })` removes history metadata, not a local file.
A failed hand-off or a transfer resumed because cancellation failed must remain untouched for
manual recovery.

**Evidence under test 2026-08-30** — the old implementation deliberately keeps the completed or
cancelled `DownloadItem` after NAS acceptance. The new unit and real-Chromium E2E regressions
assert that this entry must be absent. Before the fix, the E2E assertion reproduced the retained
entry; the evidence review then authorized the remediation described below.

**Implemented 2026-08-30** — after explicit approval, a successful hand-off erases its terminal
Chrome `DownloadItem`. Failure paths still retain or resume the browser download.
`downloads.erase()` removes Chrome history metadata only and does not delete a local file.
No history-wide migration or startup cleanup runs: QuickGet touches only the record belonging
to the current successful user action.

**Verified 2026-08-30** — unit tests prove `pause → AddTorrent success → cancel → erase` ordering
and retain history on both failure/recovery paths. A real persistent Chromium profile confirms
the successful item is absent after a full close/reopen and that no second `AddTorrent` occurs.

---

### BUG-30 — Intercepted `.torrent` still reaches the disk — no filename-stage suppression

**Severity:** medium · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts:230-247` (`handOffToNas`), `manifest.json` (permissions),
`src/lib/config.ts` (`torrentInterceptMode`), `tests/e2e/download-interception.spec.ts:113-122`

Interception is transactional but **starts too late in the download lifecycle**. `onCreated`
only fires once Chrome has already committed the transfer, so by the time `handOffToNas()`
pauses it, Chrome may have shown "Save as" and/or written the file. On a fast/small `.torrent`
the race is routinely lost: the hand-off succeeds *and* a copy lands in Downloads.

The project already knows this — `download-interception.spec.ts:113-122` asserts
`state === "interrupted" || state === "complete"` precisely because completion-before-cancel is
expected. The transaction guarantees **no data loss**, not **no local file**. That is the
correct guarantee for safety, but it is the wrong user-visible behaviour, and it makes an
honest promo recording impossible (a save dialog in frame contradicts the pitch).

**Root cause:** there is no `chrome.downloads.onDeterminingFilename` listener anywhere in the
codebase (verified: zero matches in `src/`). That event is the only hook that fires *before*
the file is committed, and it holds the download open until `suggest()` is called — which is
exactly the window a hand-off needs.

**What the API does and does not allow** (verified against `@types/chrome`):

- `onDeterminingFilename` (types `index.d.ts:4068`) — fires pre-commit, and the item "will not
  complete until all listeners have called `suggest`". Async is legal if the listener returns
  `true`. This is the real lever: hold here, hand off, then cancel before anything is written.
  Costs no new permission. **Chrome-only** — Firefox does not implement it, so the current
  behaviour must remain the fallback.
- `downloads.setUiOptions({enabled:false})` (`index.d.ts:4055`) — hides the download UI, needs
  the extra `"downloads.shelf"` permission (not currently requested; would need CWS
  justification) and is profile-global//cooperative across extensions. Cosmetic only: it hides
  the shelf/bubble, it does **not** prevent the write and does **not** suppress a "Save as"
  dialog. Not a fix on its own.
- Nothing in the API suppresses the "Ask where to save each file" dialog. If the user has that
  Chrome setting on, a dialog is unavoidable once a download exists. Only never letting the
  download reach that stage avoids it.

**Proposed fix:** add an `onDeterminingFilename` listener that, for a recognised torrent under
a new *full* mode, defers `suggest()`, performs the hand-off, and cancels on success — falling
back to the current pause/cancel path on failure or on non-Chrome. Keep the existing claim
guard (`inFlight` + `CLAIMED_PREFIX`) as the single owner across all three entry points
(`onCreated`, `onChanged`, `onDeterminingFilename`) — a third listener must not double-send.

**Risks to weigh before coding:** MV3 can suspend the worker while `suggest()` is outstanding
(the download would hang — needs the same recovery sweep as `PENDING_PREFIX`); only one
extension may register the listener; a slow NAS now delays *every* torrent download visibly.
Hence the setting below rather than a silent behaviour change.

**Research — the full MV3 option space** (checked against official docs + Chromium source,
2026-08-30). Nothing else in MV3 can stop a user-initiated download from reaching the disk:

| Option | Verdict |
|---|---|
| `downloads.onDeterminingFilename` | **The only workable lever.** Fires before a target path exists — the Chromium browser test asserts `item->GetTargetFilePath().empty()` at this stage while the item is still `IN_PROGRESS`. Holding `suggest()` (return `true`) defers Chrome's native "Save as", so cancelling here means no dialog and no final file. Needs only the `downloads` permission we already hold. **Chrome-only.** |
| `declarativeNetRequest` block/redirect | Kills the request before any byte — but only matches on URL/resource type at `onBeforeRequest`, so it cannot know it is a `.torrent` when the server declares that via `Content-Disposition`. Blunt URL-suffix rules would break normal browsing. |
| DNR `responseHeaders` conditions (Chrome 128+) | **Cannot help.** Official docs: once headers arrive "a block or redirect rule with a response headers condition will still run–but cannot actually block or redirect the request." |
| `webRequest` blocking / `onHeadersReceived` cancel | **Unavailable.** `webRequestBlocking` is policy-installed-extensions only in MV3 — not an option for a Web Store extension. |
| Content script `preventDefault()` on click | Leaky by design: misses middle-click, context-menu "Save link as", JS-initiated downloads, redirects, and any server-driven `Content-Disposition` on a normal navigation. Fine as an optimisation, never as the guarantee. |
| `setUiOptions` / `setShelfEnabled` | Cosmetic only — hides the shelf/bubble, does not prevent the write or the dialog. Needs the extra `downloads.shelf` permission. |
| `downloads.download({saveAs:false})` | Irrelevant: it governs downloads *we* start, not the user's click. |

**Caveat worth stating plainly:** even here, Chrome streams bytes into a temporary
`.crdownload` before the filename is settled (Mozilla bug 1245652 discusses exactly this
Chrome behaviour). So the honest claim is "no save dialog and no file left in Downloads",
**not** "nothing ever touched the disk".

**Firefox:** `onDeterminingFilename` does not exist — Bugzilla 1245652 has been open since
2016 and is still `NEW`, for architectural reasons (downloads are not created until after the
file picker). The current pause/cancel path must remain the Firefox fallback.

**Blocks:** DEMO-1 (a save dialog must not appear on camera). **Blocked by:** nothing.

**Correction found while implementing (2026-08-30).** The first design held `suggest()` across
the whole NAS round-trip. That is wrong: Chromium's filename determiner has its own **15-second
timeout**, after which it finishes the download into the default folder regardless — crbug
40359474 reports exactly that ("file gets downloaded into default download folder after 15
seconds leaving the save as dialog open"). A slow NAS would therefore have produced the stray
file the option exists to prevent. The shipped design instead cancels as soon as the download
is recognised as ours and calls `suggest()` immediately, so the hold spans a local decision
only. Also corrected: `suggest()` does **not** override the "Always ask where to save"
preference (`NeedsConfirmation()` checks `PromptForDownload()` independently) — it is the
*cancel while the stage is held* that keeps the prompt from appearing, not the suggestion.

**Implemented 2026-08-30 (unverified in CI — see below).** `src/background/downloads.ts`:
`handleDeterminingFilename()` holds a reserved id; `handleDownloadCreated()` cancels
immediately in strict mode, before `markInterceptionStarted()`, then releases the hold;
`handOffToNas()` takes `strict` and skips the pause/cancel transaction. `onCreated` now takes a
synchronous reservation before its first `await`, because the filename event can otherwise
arrive while settings are still loading. Every terminal path releases the hold, with a
`finally` as the backstop.

**Testing gap, stated plainly:** `onDeterminingFilename` **never fires under Playwright's
persistent context** — the automation harness assigns each download a target path itself, so
the filename stage is skipped (verified by probing the running worker: the listener registers,
the event never arrives). The e2e case is therefore `test.skip` with manual steps in its
docstring, and the logic is covered by unit tests instead (`downloads.test.ts` →
`suppressLocalTorrentFile`). **Strict mode has not been exercised against a real Chrome
profile yet** — that check is still outstanding and keeps this card In Review.
**2026-09-09 — automated, and the ten-day manual gap is closed.** The blocker was never the
feature; it was that `onDeterminingFilename` does not fire under Playwright, so strict mode could
not be exercised at all. The cause turned out to be one CDP call: `launchPersistentContext` sends
`Browser.setDownloadBehavior` with `allowAndName` at context init (playwright-core
`coreBundle.js:37972`), which names every download a GUID and skips the filename-determination
stage entirely.

Undoing it restores native handling. `launchExtensionPopup` gained a `nativeDownloads` option
that writes `download.default_directory` into the profile's `Preferences` before launch — with
`behavior: "default"` Chrome ignores `downloadPath`, so the profile is the only thing that decides
where a file lands — and then sends `Browser.setDownloadBehavior { behavior: "default" }` over a
CDP session after launch.

`download-interception.spec.ts` now runs **both arms**: strict off leaves `sample.torrent` in the
directory under its real `Content-Disposition` name, strict on leaves the directory empty. The
control is not decoration — an earlier version of this probe measured a directory Chrome was not
writing to and reported success for *both* settings.

**What is still not covered, stated plainly:** the "no Save-as dialog" half. With
`prompt_for_download: true` a headless browser cannot show a dialog, and nothing lands whether
strict is on or off, so that arm proves nothing and was dropped rather than kept as decoration.
The mechanism is the same one the file-absence assertion exercises — cancel while the filename
stage is held — but the dialog itself has still only been reasoned about, not observed.

Two things worth keeping: `acceptDownloads: "internal-browser-default"` would be the clean flag
and is unreachable from the public API, because the client coerces any truthy value to `"accept"`
(`coreBundle.js:60511`); and `onDeterminingFilename` allows exactly **one listener per
extension**, so a test cannot add a probe listener alongside ours — it must assert on outcomes.
Playwright consider CDP calls like this out of scope (issue #23776), so an upgrade may break it —
it will break loudly.

**Resolved 2026-09-09** — shipped in v2.3.0.

---

### BUG-29 — Tracker-auth send failure is painted as a hard extension error

**Severity:** medium · **Area:** background · **Status:** Done
**Files:** `src/lib/torrentSender.ts:100-104`, `src/background/downloads.ts:260-321`,
`src/background/actions.ts`, `src/background/downloads.test.ts`

A tracker 403 (`"The tracker refused the download (HTTP 403). Open the topic page and make
sure you are logged in."`, thrown at `torrentSender.ts:100-104`) is not an extension
malfunction — it is a transient, user-actionable "no access to this specific download" state.
Today `handOffToNas()`'s catch block unconditionally calls `markConfigurationProblem()`
(`downloads.ts:263`), which paints the same red `!` / `CONFIG_BADGE` (`#D93025`) used for real
extension errors (QNAP unreachable, auth token expired, not configured). The user has no way to
tell "one download needs you to log in to the tracker" from "the extension itself is broken."

**Two bugs, same root cause — error class never reaches badge selection:**
1. `classifyFailure()` (`downloads.ts:314-321`) already types failures as `"not-configured" |
   "auth" | "unreachable" | "handoff" | "recovery-needed"`, and is already able to recognize
   tracker-403 text — but its output only feeds the OS notification (`notifyFailure()`,
   line 270), never the badge decision. Every thrown error collapses into one hard-error badge
   state regardless of class.
2. `classifyFailure()`'s own substring match is stale: it checks for `"rejected the download"`,
   but the actual thrown message says `"refused the download"` — so even where the typed result
   *is* consumed, this exact case is currently misclassified as `"handoff"` instead of `"auth"`.

**No neutral state exists yet.** `actions.ts` only has `idle` (empty badge), `active` (green),
and `CONFIG_BADGE` (red `!`). A tracker-auth failure needs a third, non-alarming state — gray/
neutral, not red — that says "no access right now" without implying the extension is broken.

**Test-first 2026-08-30** — a regression test was added before any fix, per project convention
(BUG-7, BUG-11, BUG-13 all did this): `src/background/downloads.test.ts`, helper
`mockTrackerAuthFailedHandoff()` (~lines 69-75) and test `"does not raise the hard-error badge
when only the tracker refused the download (403)"` in `describe("download interception —
configuration is visible")` (~lines 772-791). It asserts `setBadgeText` is never called with
`{ text: "!" }` and `setBadgeBackgroundColor` never with `{ color: "#D93025" }` for this failure
class. Run: `npx vitest run src/background/downloads.test.ts -t "does not raise the hard-error
badge"` — fails against current code (`setBadgeText` **is** called with `{ text: "!" }`),
confirming the reported bug and not a setup/typo error.

**Required fix (not yet applied):**
- Fix the `classifyFailure()` substring so a real tracker-403 message actually classifies as
  `"auth"` instead of falling through to `"handoff"`.
- Add a neutral/gray badge state to `actions.ts` (or reuse the closest appropriate existing
  non-error state if the product decides one already fits) and route `"auth"`-classified
  send failures to it instead of `markConfigurationProblem()`.
- Keep `markConfigurationProblem()` (red `!`) reserved for failure classes that mean the
  extension/connection itself is broken (`"not-configured"`, `"unreachable"`,
  `"recovery-needed"`), not for a single download needing tracker login.
- The new test must pass without loosening its assertions; do not delete or weaken it to make
  it green.

**Reported 2026-08-30** — user observed the toolbar badge stuck on `!` after a tracker-403
send failure and flagged that this error class should not use the same icon state as a genuine
extension/NAS-connection error.

**Done 2026-08-30** — added a gray `markSendNotice()` badge (`"i"`, `#9AA0A6`) in `actions.ts`,
distinct from the red `CONFIG_BADGE`; a hard-error state already showing always outranks it.
Fixed `classifyFailure()`'s stale substring (`"rejected"` → `"refused"`) so a real tracker-403
now classifies as `"auth"`. `handOffToNas()`'s catch block now classifies once and routes
`"auth"` to `markSendNotice()`, everything else still to `markConfigurationProblem()`. The
regression test from the test-first pass now passes without being loosened. Full suite: 272/272
unit tests, typecheck and lint clean.

---

### BUG-25 — Worker death between pause and pending-marker write strands a download

**Severity:** high · **Area:** background · **Status:** Done

`handOffToNas()` pauses the Chrome download before persisting its recovery marker. MV3 may stop
the worker between those awaits, leaving no durable evidence for `recoverAbandonedHandoffs()`.
Acceptance: persist recovery intent before pause, remove it when pause does not occur, and prove
both order and cleanup with tests.

**Resolved 2026-08-29** — recovery intent is persisted before pause and removed immediately when
pause does not occur. Tests gate the pause call and assert marker ordering and cleanup.

**Removed 2026-08-30** — this recovery design made Chrome session storage a second source of
task state. QuickGet no longer persists hand-off intent or performs startup recovery; the NAS
is the only durable source of truth.

### BUG-24 — Duplicate listener releases another listener's in-flight ownership

**Severity:** high · **Area:** background · **Status:** Done

A concurrent `onCreated`/`onChanged` invocation that fails `claimDownload()` still executes the
outer `finally` and deletes the shared `inFlight` id. A third event can enter before the owner
writes its session claim. Acceptance: only the invocation that acquired ownership may release
the in-memory guard; a gated three-listener test must produce one NAS hand-off.

**Resolved 2026-08-29** — ownership is tracked per invocation; rejected listeners cannot delete
the owner's guard. As of 2026-08-30 the guard is in memory only; no durable claim exists.

### BUG-22 — Invalid settings leave a stale active toolbar

**Severity:** high · **Area:** background · **Status:** Done

If settings become invalid after an active snapshot, `pollStatus()` clears its alarm and returns
without reconciling the visible count/icon. Acceptance: a fresh unconfigured install stays quiet,
but previously live state becomes a persistent, readable attention state before monitoring stops.

**Resolved 2026-08-29** — invalid settings replace a previously live toolbar with attention before
clearing the alarm, while a never-configured installation remains silent.

### BUG-23 — Failed attention acknowledgement discards the reason

**Severity:** medium · **Area:** background · **Status:** Done

`acknowledgeAttention()` clears `failureReason` even when Chrome rejects removal of the `!` badge.
Acceptance: failed acknowledgement preserves both badge state and reason; a later successful open
returns the same reason and clears it exactly once.

**Resolved 2026-08-29** — a rejected badge clear returns but retains the reason and failure state;
only a successful acknowledgement consumes it.

### BUG-26 — Monitoring retry inherits an exhausted error streak

**Severity:** medium · **Area:** background · **Status:** Done

After give-up, opening the popup re-arms monitoring with `errorStreak >= ERROR_LIMIT`, so the first
new failure immediately gives up again. Acceptance: explicit acknowledgement starts a fresh retry
budget without letting unrelated successful work erase an unread failure.

**Resolved 2026-08-29** — successful acknowledgement resets the monitoring error streak before
reconciliation is re-armed.

### BUG-28 — Concurrent monitoring requests duplicate QNAP task queries

**Severity:** medium · **Area:** background/performance · **Status:** Done

Parallel interception, popup and acknowledgement events could each run an immediate `Task/Query`.
**Resolved 2026-08-29** — immediate monitoring is single-flight with dirty/rerun semantics: an
overlap produces at most one catch-up query, so a newer mutation is reconciled rather than dropped.

### BUG-27 — Every monitoring poll reads settings twice

**Severity:** low · **Area:** background/performance · **Status:** Done

`pollStatus()` loads settings for validation and `getClient()` loads them again. Acceptance: one
settings snapshot must drive validation, client signature, and client creation for the whole poll;
a test must assert one load per tick.

**Resolved 2026-08-29** — validation, signature and client creation share one settings snapshot;
tests assert a single settings load per poll.

### BUG-20 — Monitoring give-up leaves a permanently stale active toolbar

**Severity:** high · **Area:** background · **Status:** Done

After four failed QNAP polls the alarm stopped while the last active count/icon remained visible
indefinitely. **Resolved 2026-08-29** — sustained monitoring failure now replaces the stale count
with a persistent attention state explaining that Download Station is unreachable. Opening the
popup acknowledges it and immediately re-arms reconciliation.

### BUG-19 — Rapid zero snapshots can clear an active toolbar prematurely

**Severity:** high · **Area:** background · **Status:** Done

Two popup snapshots could increment `zeroStreak` within milliseconds and masquerade as two
30-second confirmations. **Resolved 2026-08-29** — idle requires two confident zeros separated by
at least 30 seconds; a new interception resets that window. Unit and real-Chromium tests cover the
rapid-zero and confirmed-stop paths.

**Reopened 2026-08-30** — after every task was deleted directly in Download Station, opening the
popup successfully rendered an empty task list but left the toolbar active for 30–60 seconds. The
popup's `qg:badgeSnapshot` was treated as an ordinary alarm result, so it entered the same
hysteresis window intended for a lone background poll.

**Resolved again 2026-08-30** — a completed popup `Task/Query` now explicitly confirms idle and
clears the toolbar immediately when it contains no active tasks. Alarm polling still requires two
zeros at least 30 seconds apart, preserving protection against a transient backend result. Unit
and real-Chromium regression tests cover active → empty-popup-snapshot → idle.

### BUG-18 — Rejected action writes are cached as successfully painted

**Severity:** high · **Area:** background · **Status:** Done

Rejected `setBadgeText`, `setTitle`, or `setBadgeBackgroundColor` calls still updated persisted
state, so the diff guard suppressed retries. **Resolved 2026-08-29** — every action mutation is
awaited and cached only after success, with reject-once/retry tests for all three APIs.

### BUG-21 — Concurrent monitoring requests can recreate and postpone the alarm

**Severity:** medium · **Area:** background · **Status:** Done

Parallel `armMonitoring()` calls could both observe no alarm and recreate the same named alarm.
**Resolved 2026-08-29** — same-worker arming is serialized and `alarms.create()` is awaited; a
gated concurrency test proves one creation.

### BUG-17 — Context-menu actions are unclear and appear in irrelevant places

**Severity:** medium · **Area:** background/UX · **Status:** Done
**Files:** `src/background/menus.ts`, `src/background/menus.test.ts`

Chrome currently registers `Send with QuickGet` for both links and arbitrary selected text, and
`Send current page with QuickGet` for every page context. The labels do not explain what object
will be sent, where it will go, or the difference between the two actions. The page action also
appears away from download links and can be visible on QuickGet's own extension UI, where its
purpose is especially unclear.

**Required investigation:** enumerate the useful user journeys (torrent link, magnet, direct file
URL, selected URL and current-page URL); decide whether current-page sending is a real supported
feature or accidental surface area; test Chrome `documentUrlPatterns`/`targetUrlPatterns` limits;
exclude extension and unsupported schemes where possible; and replace the labels with explicit
object/action wording. The menu must not imply that arbitrary page content is sent when the
implementation only passes `tab.url`, and invalid selected text should not be presented as a
working action if Chrome cannot conditionally validate it.

**Reported 2026-08-29** — users cannot infer the distinction between `Send with QuickGet` and
`Send current page with QuickGet`; both appear in unexpectedly broad contexts, including the
extension itself.

**Resolved 2026-08-29** — retained one link-only action named `Send link to Download Station`.
Removed the page and selected-text actions, restricted the menu to web documents, and reject
non-HTTP(S)/magnet targets before contacting the NAS.

---

### BUG-15 — Captured torrent status is slow to become visible

**Severity:** medium · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts`, `src/background/actions.ts`, `src/background/alarms.ts`

After Chrome captures a torrent, the toolbar/popup can keep showing the previous state for a
noticeable time. Establish a timestamped real-browser trace for `onCreated → pause → AddTorrent →
Task/Query → chrome.action repaint → popup render` and separate delays owned by QuickGet from
Download Station visibility lag and Chrome/MV3 scheduling limits.

**Required investigation:** determine whether QuickGet can publish an immediate explicit
`Sending to NAS`/working state before the NAS task becomes queryable; measure whether status
changes are skipped by the toolbar state cache, the 30-second alarm cadence, service-worker
suspension, popup polling, or QNAP eventual consistency. Document unavoidable platform limits
and add deterministic tests for every improvement that remains under our control.

**Reported 2026-08-29** — the captured torrent is handed off, but the visible status changes too
late for the user to understand that processing has started.

**Resolved 2026-08-29** — hand-off publishes the active working state (`Sending torrent to QNAP…`)
before contacting the NAS, then starts an immediate catch-up query instead of waiting for the
30-second alarm. Two zero snapshots separated by at least 30 seconds are required before returning
to idle. Unit and real-Chromium tests cover immediate visibility, rapid-zero resilience and
single-flight monitoring.

---

### BUG-16 — Interception error badge has no defined lifetime

**Severity:** medium · **Area:** background · **Status:** Done
**Files:** `src/background/actions.ts`, `src/background/notifier.ts`, `src/background/alarms.ts`

The red `!` after a failed torrent interception has no documented product lifetime. It is unclear
whether it should persist until explicit acknowledgement, disappear after a timeout, clear after
the next successful hand-off, or remain until the underlying failure is demonstrably resolved.

**Required investigation:** compare error-state lifecycles in Chrome/Edge downloads, QNAP,
Synology and established torrent clients; distinguish transient interception failures from
persistent NAS connectivity/configuration failures; define acknowledgement, timeout and recovery
rules that do not hide a failure before the user can notice it. Cover MV3 restarts, concurrent
success/failure ordering and stale persisted toolbar state with tests before changing behaviour.

**Reported 2026-08-29** — the user expected the interception error to remain visible only for a
bounded time, but the intended behaviour and competing conventions have not been established.

**Resolved 2026-08-29** — product rule: the error has no timer. Its reason is persisted for the
browser session and the red `!` remains until the popup is opened. Opening the popup atomically
returns the reason for the top error pill and acknowledges the toolbar alarm; later successful
handoffs and background polls cannot erase an unread failure.

---

### BUG-14 — Context-menu sends omit working and failure toolbar states

**Severity:** medium · **Area:** background · **Status:** Done
**Files:** `src/background/menus.ts`, `src/background/menus.test.ts`

The context-menu path starts the same AddUrl/AddTorrent process but only requests a NAS poll
after success. While the request is in flight the toolbar remains idle, and on failure it
shows only a transient notification without the persistent red action state.

**Reproduced 2026-08-28** — gated AddUrl test observes zero active-icon writes before the NAS
response; rejected AddUrl leaves no `qg:toolbarState` failure marker.

**Done 2026-08-28** — both AddUrl and fetched-torrent context-menu sends now publish the active
state before network completion, clear only an older failure on success, and persist red on
failure. Both new regressions pass.

---

### BUG-13 — Toolbar repaint failure aborts the NAS hand-off

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/actions.ts`, `src/background/downloads.test.ts`

`markInterceptionStarted()` awaits `chrome.action.setIcon()` in the critical hand-off path.
If Chrome rejects that cosmetic API call, the torrent is never sent to the NAS. A toolbar
rendering failure must be observable in diagnostics but must never control the transfer.

**Reproduced 2026-08-28** — regression test forces `setIcon()` to reject; `AddTorrent` receives
zero requests and the browser download is not cancelled.

**Done 2026-08-28** — toolbar API failures are caught at the visual boundary. They no longer
abort a hand-off or turn a valid NAS snapshot into a monitoring failure; failed icon state is
not cached as applied, so a later transition retries it.

---

### BUG-12 — Parallel toolbar transitions lose the newer failure state

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/actions.ts`, `src/background/downloads.test.ts`

Toolbar writers independently perform `storage.session.get → mutate → set`. Two overlapping
operations can read the same revision and save in reverse order, allowing an older green
working transition to erase a newer red failure. Revision comparison cannot protect data that
was already lost by the write race.

**Reproduced 2026-08-28** — deterministic gated test overlaps the working repaint with a
parallel failure. Final persisted state is incorrectly empty at revision 0 instead of red `!`
at revision 1.

**Done 2026-08-28** — every toolbar state transition (event, poll, failure counter, clear and
reset) now passes through one same-worker queue while authoritative state remains in
`storage.session`. The deterministic overlap tests preserve the newer red revision.

**Verification:** 210/210 unit tests, 18/18 mock Chromium E2E, typecheck, Svelte check, lint and
production build all green.

---

### BUG-11 — Toolbar icon updates only after a later poll or popup click

**Severity:** medium · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts`, `src/background/actions.ts`

The interception listener has already claimed and paused a torrent, but it does not publish
that real process transition to `chrome.action`. It waits until `AddTorrent` finishes and then
queries the NAS. A newly accepted task may not appear in that first query, so the icon stays
idle until an alarm tick or opening the popup sends a fresh snapshot. The result looks as if
the toolbar needs a click to repaint, although Chrome was never asked to repaint it.

**Required behaviour:** drive the toolbar from the interception lifecycle itself — green as
soon as a valid hand-off starts, red on failure, then reconcile the count from the NAS. A
failure must remain red even when another hand-off succeeds concurrently; completion order
must not let the success clear a newer failure.

**Test-first 2026-08-28** — add regression coverage for the in-flight success state and for
concurrent success/failure ordering before changing production code.

**Done 2026-08-28** — both regression tests failed on the old implementation: no `setIcon`
call occurred while `AddTorrent` was in flight, and an earlier success cleared a later red
failure. `markInterceptionStarted()` now publishes the green active icon directly from the
download event and returns the current failure revision. A success clears only an error that
predates its own start; a newer parallel failure keeps the red `!` and its tooltip even when a
successful NAS snapshot reports active tasks. The targeted tests then passed (46/46), followed
by the full suite (203 unit, 17 mock E2E).

**Reopened 2026-08-28** — real Chrome still delays the visible change. The first regression
started from an empty toolbar cache and missed a cache/UI drift: after an extension reload the
persisted state may say `active` while Chrome is displaying the manifest's idle icon, causing
the diff guard to skip the explicit repaint. Add this state to the regression suite and verify
the event-to-toolbar transition in real Chromium rather than only through the unit mock.

**Done again 2026-08-28** — the reopened regression failed with zero `setIcon` calls. An
explicit interception event now always writes the active icon and title, even when the cached
values match. Real Chromium E2E seeds the stale-cache condition and requires the action title
to change within 2 seconds, before the deliberately delayed torrent transfer completes. Full
suite: 204 unit and 17 mock E2E.

**Lifecycle verification 2026-08-28** — Chromium E2E now also proves both terminal states:
two confirmed zero snapshots clear the badge and persist `icon: idle`, while a rejected NAS
hand-off keeps the browser download and exposes a red `!` badge (`#D93025`). The completion
case was repeated three times in parallel before the full 18-test mock E2E gate passed.

---

### BUG-2 — Browser download cancelled before the NAS hand-off succeeds

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts:55-56`

`cancelBrowserDownload()` runs before `sendAndNotify()`, and the outcome is never checked.
Any failure after that line leaves the user with no file and no NAS task. Causes silent data
loss on: locked extension, wrong password, NAS offline, timeout, QNAP API error, or a
one-time tracker URL that cannot be fetched twice.

**Root cause:** ordering inherited from the removed `"ask"` mode, where cancelling first was
correct. `2ed381c` deleted the mode and left the `cancel` call in place.

**Fix:** make it transactional — pause → hand off → cancel on success, resume on failure.

**Blocks:** nothing. **Blocked by:** nothing. Do this first; it is the only data-losing defect.
**Done 2026-08-27** — `handOffToNas()` in `src/background/downloads.ts`: pause → send → cancel on
success, resume on failure. Covered by `downloads.test.ts`, which asserts the pause/cancel
ordering via `mock.invocationCallOrder`.

---

### BUG-3 — Locked / empty-credential state unguarded in background

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts:47`, `src/lib/settings.ts:93,209-215`

With `rememberPassword: true` and no unlock, `loadSettings()` returns `NASpassword: ""` and
the NAS login fails — after BUG-2 already cancelled the download. `isLocked()` is used only
by the popup.

`isLocked()` alone is **not** a sufficient guard: with `rememberPassword: false` after a
browser restart the password is also empty, yet `isLocked()` returns `false`. The correct
precondition is `if (!settings.NASpassword) return;`; `isLocked()` only picks the notification
wording.

**Root cause:** locking was designed as a popup-UI concern; the headless background entry
point into the same NAS client was never enumerated as a consumer of the precondition.

**Fix:** guard before touching the download, notify, leave the browser download alone.
Ship together with BUG-2 — same function, same commit.
**Done 2026-08-27** — `if (!settings.NASpassword)` guard before the download is touched;
`isLocked()` only selects the notification wording. Both the locked and the
restart-cleared-session cases are covered by tests.

---

### BUG-4 — Hand-off failure swallowed by `sendAndNotify`

**Severity:** medium · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts:79-82`

Catches, notifies, and returns normally, so a rejected NAS operation becomes a fulfilled
promise. The caller cannot tell success from failure and cannot roll the download back.
On its own cosmetic — but it is what makes BUG-2 silent.

**Root cause:** under `"ask"` the function was called from a notification-button handler with
no caller to propagate to, so swallowing was correct. The refactor made it a step in a
sequence that needs the result.

**Fix:** separate the critical operation from the notification; let the error propagate.
Ship with BUG-2.
**Done 2026-08-27** — `sendAndNotify()` is gone. `handOffToNas()` keeps the critical operation
and the rollback in one place, and the error reaches the caller instead of being absorbed.

---

### BUG-1 — Interception default flipped to `off` and persisted on read

**Severity:** high · **Area:** settings · **Status:** Done
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

---

### BUG-7 — No test coverage for `handleDownloadCreated`

**Severity:** medium · **Area:** testing · **Status:** Done
**Files:** `tests/mocks/chrome.ts`, `src/background/downloads.test.ts` (absent)

The function carrying BUG-2 through BUG-5 has never had a test. A `downloads.test.ts` existed
but only covered `sweepStalePending`, a helper of the `"ask"` mode, and was correctly deleted
with the feature in `2ed381c` — nothing replaced it. `tests/mocks/chrome.ts` has no
`chrome.downloads` or `chrome.notifications` stubs, so the mock must be extended first.

**Fix:** extend the mock; add unit tests asserting call *order* (mode off; success →
pause/send/cancel; locked; empty password; NAS failure → resume; default not persisted).
Then one Playwright spec driving a real download through the mock NAS — that is the only
layer that can prove the browser download actually resumes.

**Sequencing:** write the failing tests against the current code *before* fixing BUG-2, so
the fix is proven.
**Done 2026-08-28** — `tests/mocks/chrome.ts` gained `downloads`/`notifications` stubs and
`createDownloadItem()`; `src/background/downloads.test.ts` covers 18 cases (written against the
old code first: 4 of the first 6 failed). `tests/e2e/download-interception.spec.ts` drives three
real Chrome downloads through a delaying torrent host, including the two original defects: an
unreachable NAS and a missing credential must both leave the file intact. Added to
`test:e2e:mock`, so CI gates on it.

---

### BUG-5 — `.torrent` detection gaps

**Severity:** low · **Area:** background · **Status:** Done
**Files:** `src/lib/torrentSender.ts:57-60`

- `/\.torrent(\?|$)/i` misses fragments — `foo.torrent#bar` slips through.
- `item.filename` is never consulted, though it often carries the `Content-Disposition` name.
- Only `onCreated` is observed; Chrome may reveal the real MIME type or `finalUrl` later via
  `onChanged`, so endpoints like `/download?id=1234` are never intercepted.

No data loss — misclassification simply skips interception. Harden after the above are green.

**Done 2026-08-28** — `hasTorrentExtension()` accepts `?` and `#`; `isTorrentSource()` also takes
`item.filename`; a `downloads.onChanged` listener re-evaluates a download once Chrome learns its
MIME type or final URL. Adding that listener needed the claim described in BUG-9, since two
listeners can now recognise the same download.

---

### BUG-6 — Documentation drift

**Severity:** low · **Area:** docs · **Status:** Done
**Files:** `README.md:8,34`, `docs/feature-roadmap.md:220`

README claims interception is enabled by default (BUG-1 says otherwise). The roadmap still
describes modes as `off/ask/always`, but `INTERCEPT_MODES` has been `["off", "always"]` since
`2ed381c`. If `"ask"` ever shipped, stored values are now invalid and get silently rewritten
to `"off"`, feeding BUG-1. *Unverified: `"ask"` may never have reached users.*

**Done 2026-08-27** — `README.md` now describes the pause/resume behaviour accurately;
`docs/feature-roadmap.md` no longer lists the removed `ask` mode.

---

### BUG-8 — No settings schema version or migration path

**Severity:** medium · **Area:** settings · **Status:** Done

A stored `"off"` cannot be distinguished between "the bug wrote it" and "the user chose it",
so it must not be flipped silently. Needs a `settingsSchemaVersion` key and an
`onInstalled(details.previousVersion)` hook: for profiles upgrading from an affected version,
notify once rather than rewriting the user's choice.

Prerequisite for closing BUG-1 properly.

**Done 2026-08-27** — `SETTINGS_SCHEMA_VERSION` + `migrateSettings(previousVersion)` in
`src/lib/settings.ts`, called from `onInstalled` in `src/background/index.ts`. A stored `"off"`
from **1.0.2 only** raises a one-time notification and is never rewritten — verified against the
history: 1.0.0 and 1.0.1 shipped the correct `"always"` default, so an `"off"` there is the
user's own choice. The "shown" marker is separate from the schema version and is written only
after the notification was actually created.

---

### BUG-9 — Service worker death between pause and cancel/resume

**Severity:** medium · **Area:** background · **Status:** Done
**Files:** `src/background/downloads.ts`

Raised by an external review of the BUG-2 fix. MV3 terminates the service worker on its own
schedule — an unreachable NAS can outlive it — so neither the cancel nor the resume runs and
the browser download stays paused with nothing left to release it. Precisely the failure case
the fix was meant to cover.

The reviewer's remedy was to drop `pause` entirely (`send → cancel on success, otherwise leave
it alone`). Rejected: without a pause the `.torrent` usually lands on disk, which is what
interception exists to prevent.

**Done 2026-08-28** — a `qg-pending-<id>` marker in `chrome.storage.session` is written before
the hand-off and cleared in a `finally`. `recoverAbandonedHandoffs()` runs on every worker
start and resumes whatever was left behind. Session storage survives a worker restart but not
a browser restart, which is the right lifetime: a download interrupted by a browser restart is
not resumable anyway.

**Related, found while testing this:** `onCreated` and `onChanged` can both recognise the same
download, and a claim implemented as `await get()` then `set()` let both callers read
"unclaimed" and send the torrent twice — visible in E2E as the torrent host being fetched five
times instead of three. The claim is now taken synchronously from an in-memory set before the
first await, with the session marker carrying it across restarts.

**Superseded 2026-08-30** — persistent pending/claim markers, startup recovery and the duplicate
task Resume notification were removed. Only a synchronous in-memory guard remains for
concurrent `onCreated`/`onChanged` events; it disappears when the operation or worker ends.

---

### BUG-10 — Right-click send hands login-protected links to the NAS as bare URLs

**Severity:** high · **Area:** background · **Status:** Done
**Files:** `src/background/menus.ts`, `src/lib/torrentSender.ts`

Reported for a login-protected tracker: right-clicking a `dl.php`-style link and sending it
with the extension produced an HTML file on the NAS instead of a torrent.

`sendDownloadToStation()` always called `client.addUrl(url)`, handing the NAS a bare link. The
NAS has no session on the tracker, so it received the login page — HTTP 200, so nothing looked
wrong — and Download Station stored that HTML as the task.

The interception path had solved this from the start: fetch the `.torrent` in the browser with
`credentials: "include"` so the user's tracker cookies apply, then upload the file itself. The
context menu simply never used it.

**Worked before the fix:** anything needing no session — magnets, public direct `.torrent`
links, ordinary files. **Failed:** every login-protected tracker and any tokenised URL.

**Done 2026-08-28** — the context menu routes torrent sources through `sendTorrentUrlToNas()`,
with routing rules still applied to the destination. Magnets and plain URLs stay on `AddUrl`,
which is correct for them. `assertLooksLikeTorrent()` now rejects a payload that is not
bencoded (`d` + digit) and not `application/x-bittorrent`, so a login page becomes a clear
error — "the tracker returned a web page … you may need to log in" — instead of a broken NAS
task. Six tests in `menus.test.ts`, five of which fail on the old code, plus an opt-in live spec
(`tests/e2e/private-tracker.real.spec.ts`) that proves an extension-origin fetch really carries
the site session — the target site is configured locally and not recorded here.

---

## Measured behaviour worth remembering

E2E (`tests/e2e/download-interception.spec.ts`) established something the design assumed
otherwise: **a small `.torrent` from a fast host reaches `complete` before the cancel can take
effect**, so Chrome keeps a local copy even on a fully successful hand-off. The pause/cancel
transaction therefore protects against *loss*, not against a stray file. The spec asserts the
contract that actually holds — the download is never left in progress — rather than a
`interrupted` state that only occurs when the transfer is slow enough. The torrent host in the
test delays its body specifically so the transaction under test can happen at all.
