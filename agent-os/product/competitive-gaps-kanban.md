# Competitive gaps — Kanban

Gaps found by comparing our shipped behaviour against what competing QNAP/Synology
Download Station clients do, and against what *their users complain about*. Analysis and
sources: [`../../docs/competitor-analysis.md`](../../docs/competitor-analysis.md); feature
detail: [`../../docs/feature-roadmap.md`](../../docs/feature-roadmap.md).

**Columns:** `Backlog` → `In Progress` → `In Review` → `Done`.
Move a card by editing its Status cell; add a dated line under the card when the status
changes.

A card only belongs here if a competitor does something we do not, **and** there is
evidence a user wants it. Parity for its own sake is not a goal — several deliberate
non-features are recorded at the bottom so they are not re-litigated.

---

## Board

| ID | Gap | Area | Size | Status |
|----|-----|------|------|--------|
| GAP-1 | `magnet:` clicks are never intercepted | background/content | M | Backlog |
| GAP-2 | No survival story for a QTS firmware upgrade | api | M | Backlog |
| GAP-3 | Offline queue — links are lost when the NAS is asleep | background | M | Backlog |
| GAP-4 | No undo on remove | popup/ui | M | Backlog |
| GAP-5 | Listing does not claim the maintenance gap left by the segment leader | store | S | Backlog |

---

## Cards

### GAP-1 — `magnet:` clicks are never intercepted

**Size:** M · **Area:** background/content · **Status:** Backlog
**Files:** new `src/content/magnet.ts`; `manifest.json` + `manifest.firefox.json`;
`src/lib/config.ts` (`DEFAULTS`); `src/popup/features/settings/Settings.svelte`

We intercept `.torrent` **files** through the downloads API, but a `magnet:` click never
reaches that API — the browser hands it straight to an external application. So the single
most common way to start a torrent silently bypasses the extension.

Competitors treat this as a headline feature, not an extra:

- *Download Station (Synology)*, Firefox — "Auto-capture magnet links and send them to your
  Synology NAS" is listed **first** in its feature list.
- *Send To QNAP++* — "Universal Support — Seamlessly handle Torrents, Magnets, and standard
  HTTP/HTTPS files".
- *NAS Download Manager* — "Open some types of links (e.g. `magnet:`) in the extension
  rather than a desktop application".

**The permission question is already settled — check the manifest before re-opening it.**
`manifest.json` today declares `host_permissions: ["http://*/", "https://*/"]` plus
`scripting`. The broad host grant **is already there**, and the install-time warning the user
sees ("Read and change all your data on websites you visit") does not change by adding a
content script. So a manifest-declared script costs no new permission and no new warning; an
optional-permission flow would add a consent step the user has effectively already given, for
no reduction in what we can reach. Declare it in the manifest, and keep the *behaviour*
opt-in through the setting below.

**Acceptance criteria**

- [ ] With `autoCaptureMagnets` on, a left-click on `<a href="magnet:?xt=...">` sends the URI
      to the NAS and no external application is launched.
- [ ] With the setting off, no listener is attached and the click behaves exactly as today.
- [ ] Toggling the setting takes effect in already-open tabs without a reload
      (`chrome.storage.onChanged`).
- [ ] Modified clicks (middle-click, ⌘/Ctrl-click) and non-primary buttons are left alone.
- [ ] A magnet click while the NAS is unreachable surfaces the same error path as a
      `.torrent` hand-off, and does **not** silently swallow the navigation.
- [ ] Firefox parity is decided explicitly: `manifest.firefox.json` either gains the script
      or the card records why not.

**Implementation sketch**

Content script at `document_start`, capture-phase listener on `document` (not per-anchor —
anchors appear dynamically), matching `event.target.closest('a[href^="magnet:"]')`. On a
plain primary click: `preventDefault()`, then `chrome.runtime.sendMessage` to the worker,
which reuses the existing add-task path rather than a second implementation. Gate behind
`autoCaptureMagnets` in `DEFAULTS`, read once at injection and updated live via
`chrome.storage.onChanged`.

**Failure modes**

- **Swallowing a click and then failing** is the worst outcome — the user loses the link with
  no feedback. Only `preventDefault()` once the message has been accepted for delivery, and
  fall back to the default navigation on any error.
- SPAs that re-render between `closest()` and dispatch.
- Pages that call `stopPropagation()` in their own capture-phase handler; a capture listener
  on `document` runs first, but note the ordering assumption.
- The worker may be asleep — `sendMessage` wakes it, but the response must not be awaited in
  a way that blocks the click handler.

**Test plan**

- Vitest: the click-eligibility predicate (modifier keys, button index, nested markup) as a
  pure function, so it is testable without a DOM harness.
- Playwright e2e alongside `download-interception.spec.ts`: a fixture page with a magnet
  anchor; assert the mock NAS received the task and no navigation occurred. Add the mirror
  case with the setting off.

### GAP-2 — A NAS firmware change reads as "no downloads", not as a fault

**Size:** M · **Area:** api · **Status:** Backlog
**Files:** `src/lib/tasks.ts` (`normalizeTasks`, `asRecord`); `src/background/alarms.ts`
(`pollStatus`); `src/popup/features/downloads/`

The most damaging failure in this category is not a bug in the extension — it is a NAS
firmware update changing the API underneath it. It has killed competitors outright:

- `seansfkelley/nas-download-manager` #166: DSM 7 broke right-click sending; the maintainer's
  own note — "Synology confirmed they are changing how this extension will have to talk to
  Download Station in DSM 7, but they have declined to specify how or when". The extension
  stayed incompatible for months.
- #147: "unable to connect to DSM after the latest Update … everything was working fine until
  Synology DSM update."
- Reddit /r/qnap on Download Station 5: "Search is completely broken again … I think it broke
  a few months back after a QTS firmware upgrade."

**The specific hole, located (2026-08-31).** Session expiry is already handled correctly
(single-flight re-login and replay, `api/index.ts`). The unhandled case is a response that
authenticates fine but no longer has the shape we expect. Today:

- `asRecord` (`tasks.ts:180`) returns `{}` for anything that is not an object;
- `normalizeTasks` (`tasks.ts:325`) tries `payload`, `.tasks`, `.data`, `.result` in turn and
  falls back to `?? []` when none match;
- `pollStatus` keeps the last-known badge on failure — correct for a transient error.

So a renamed envelope key produces **an empty task list and no error at all**. The user sees
"no downloads" while their NAS is downloading, and we never hear about it. That is precisely
the silent breakage that cost the competitors months.

**Acceptance criteria**

- [ ] `normalizeTasks` distinguishes "the NAS reported zero tasks" from "no recognised
      envelope key was present" and the two are not both `[]`.
- [ ] The second case surfaces in the popup as a specific message naming the likely cause —
      a Download Station update — not a generic failure.
- [ ] The message includes the QTS/DS version we already read, and a link to the issue
      tracker, so a user report arrives with the one fact we need.
- [ ] A well-formed empty list still renders the ordinary empty state, with no warning.
- [ ] No telemetry, no automatic reporting: the user chooses to open the link.

**Implementation sketch**

Change `normalizeTasks` to return a discriminated result (`{ kind: "tasks" } | { kind:
"unrecognised", sawKeys }`) rather than a bare array, and let the caller decide. Keep the
envelope-key tolerance we already have — it is what makes us work across QTS versions — but
stop conflating "not found" with "empty".

**Do not build a retry.** We cannot pre-empt an unknown API change; the deliverable is
diagnosis. Turning a silent breakage into an actionable report is the whole value.

**Failure modes**

- A genuinely empty NAS must never warn. This is the regression that would make the feature
  worse than nothing.
- A partially-changed response where the envelope is fine but per-task fields moved:
  `normalizeQnap` would yield tasks with undefined fields. Worth deciding whether a task that
  normalises to no id/name counts as unrecognised.

**Test plan**

- Vitest against `normalizeTasks`: a real QTS 5 payload, an empty-but-valid payload, a
  renamed-envelope payload, and a payload whose task records lost their id field. This is a
  pure function — the whole card is cheap to test.
- Playwright: mock NAS variant returning a renamed envelope; assert the popup shows the
  update-specific message rather than the empty state.

### GAP-3 — Offline queue: links are lost when the NAS is asleep

**Size:** M · **Area:** background · **Status:** Backlog
**Files:** `src/background/downloads.ts` (`handleDownloadCreated`); `src/lib/config.ts`;
`src/popup/features/downloads/`

*Send To QNAP++* advertises: "Offline Queuing — If your NAS is asleep or unreachable, links
are safely queued and sent automatically when it reconnects." A spun-down NAS is the normal
state for a home user, so this is a real scenario rather than an edge case.

**What we already do, and must not break.** `handleDownloadCreated` is deliberately
transactional (see its comment): pause the browser download, try the hand-off, and cancel
**only** once the NAS has accepted it — otherwise resume and let the browser finish. So an
unreachable NAS today does not lose the file; the browser downloads it locally. BUG-33 made
interception wait for a live connection for the same reason.

That makes this card narrower than the competitor's framing: the file is not lost, but the
user's *intent* — "this belongs on the NAS" — is. With `suppressLocalTorrentFile` on, the
fallback is also least useful, because the point of that setting is not keeping the file here.

**Acceptance criteria**

- [ ] With the NAS unreachable, the user can choose to queue the link instead of taking the
      local download; the choice is explicit, never automatic.
- [ ] A queued item is visible in the popup with a distinct pending state and can be removed.
- [ ] The queue survives a service-worker restart and a browser restart.
- [ ] A queued item is sent when the NAS next answers, and the user is told it happened.
- [ ] Nothing is ever sent silently long after the fact without the user being able to see it
      in the popup first.
- [ ] The existing transactional guarantee is untouched: a failed hand-off still resumes the
      browser download.

**Implementation sketch**

Persist the queue in `chrome.storage.local` (not `session` — it must outlive the worker and
the browser). Drain on the existing `alarms.ts` poll when a poll succeeds; there is already a
self-arming alarm, so no new timer and no keepalive — this must not become the ping we
rejected in F2.

**Failure modes**

- **A surprise download hours later** is the failure that makes this feature hated. Pending
  state must be visible and dismissible before anything is sent.
- Single-use / token-signed URLs are dead by the time the NAS wakes; queueing them produces a
  confident failure later. Consider marking hand-offs whose URL carries a query signature.
- Unbounded growth if the NAS stays down for weeks — cap it, and say what the cap is.
- Duplicate sends if a drain overlaps the next poll.

**Test plan**

- Vitest: queue persistence, dedup, cap, and drain ordering as pure logic over a fake storage.
- Playwright: mock NAS starts unreachable, the item queues, the NAS comes up, the drain fires
  on the next poll, and the popup reflects each transition. `mockNas.ts` can already be
  started and stopped mid-test.

### GAP-4 — No undo on remove

**Size:** M · **Area:** popup/ui · **Status:** Backlog
**Files:** `src/popup/components/` (status/toast infrastructure); the downloads feature

Already in the roadmap (F4), deferred for a real reason: removal is an immediate NAS call, so
a true undo means delaying the call and adding a toast that can carry an action. Our
`showStatus` banner is transient and text-only — `Settings.svelte:183` shows the shape it
supports (`showStatus(..., { autoHideMs: 2000 })`), which is a notice, not an affordance.

**This card is blocked on infrastructure, and that is the honest status.** The work is
"action-capable toast", and undo is its first consumer. Sizing it as a downloads-feature card
understates it.

**Acceptance criteria**

- [ ] A removed task shows an undo affordance for a bounded window before the NAS call fires.
- [ ] Dismissing, navigating away, or closing the popup commits the removal — it must never
      be left ambiguous.
- [ ] The popup closing mid-window does not strand the task in a half-removed state.
- [ ] Keyboard reachable and announced to assistive tech; `a11y.spec.ts` covers the popup.

**Open question to settle first:** the popup is destroyed the moment it loses focus, which is
a hostile environment for a delay-then-commit pattern. Either the delay lives in the service
worker (durable, but "undo" then spans a context the user cannot see) or the popup commits on
unmount (simple, but the window is however long the popup happens to stay open). Decide this
before any UI work.

**Test plan**

- Vitest for the commit/cancel state machine, driven without a DOM.
- Playwright: remove, undo, assert the mock NAS never received the removal; then remove,
  close the popup, assert it did.

### GAP-5 — Listing does not claim the maintenance gap

**Size:** S · **Area:** store · **Status:** Backlog
**Files:** `CHROMEWEBSTORE.md`

The competitive picture at submission time (checked 2026-08-31):

| Extension | Store | Rating | Users | Last update |
|---|---|---|---|---|
| NAS Download Manager (Synology) | AMO | 4.3 (145) | 3,711 | Sep 2023 — **maintenance mode** |
| QNAP Download Station Manager | CWS | **2.3 (7)** | — | — |
| Send To QNAP++ | AMO | 5.0 (1) | 18 | Jul 2026 |
| Download Station (Synology) | AMO | 3.0 (2) | 69 | Feb 2026 |

The segment leader is explicitly in **maintenance mode** with its last release three years
old, and the direct QNAP competitor in our own store sits at **2.3/5**. Nobody active is
serving this niche well.

Actively maintained, tested and open source is therefore our strongest differentiator, and
the listing does not currently say so.

**Acceptance criteria**

- [ ] The description states maintenance and openness as **verifiable facts** — public
      repository, CI gate, test count — not adjectives.
- [ ] No competitor is named, compared to, or characterised. CWS forbids it, and a listing
      that runs down another product ages badly regardless of policy.
- [ ] Every claim is checkable by a reviewer from the linked repository in under a minute.
- [ ] Numbers that will drift (test counts) are either kept current or written so they do not
      need to be.

**Note on the table above:** these figures were read from store listings on one day. They are
evidence for the *decision*, not content for the listing — do not transcribe them into it.

## Deliberately not doing

Recorded so they are not re-opened as "gaps":

- **Keepalive ping.** *Download Station (Synology)* advertises a "Background session
  keepalive (3-minute ping)". Rejected in F2 on battery and privacy grounds — we self-disarm
  at idle, and our expiry-retry already covers correctness. A timer that wakes every three
  minutes to talk to a NAS the user is not using is a cost, not a feature.
- **SID in `storage.session`.** Consciously skipped (F2): saves one ~100–300 ms login after a
  service-worker wake while adding an async read to every request.
- **Rename-after-download** (`nas-download-manager` #165). Belongs to the NAS, not to a
  browser extension; Download Station owns the file once the task is handed over.
- **BT search in the popup.** Download Station's own search is widely reported broken by
  QNAP's users; wrapping someone else's broken feature inherits their bug reports.
