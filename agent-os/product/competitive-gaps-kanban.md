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
| RES-1 | Verify on a live NAS how `AddUrl` handles a magnet URI | api/research | S | Backlog |
| RES-2 | Decide whether `ftp://` links are worth supporting | api/research | S | Backlog |
| RES-3 | Establish what the NAS allows for per-task destination folders | api/research | M | Backlog |
| GAP-6 | No choice of destination at send time | popup/background | M | Backlog |

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

**Prior art — the established shape of this, and what it gets wrong**

Mature clients in this category converge on the same minimal approach, and it is simpler than
the sketch above: a single non-capture `click` listener on `document`, walk up from
`event.target` to the nearest anchor (bounded depth, ~10, so a deep tree cannot cost a
traversal on every click), match the href against a list of *download-only protocols* rather
than hard-coding `magnet:`, hand it off, then `preventDefault()`. The enabled flag is held in
a module-level variable kept fresh by a settings subscription, so the listener itself does no
async work.

Two things in that shape are worth deliberately **not** copying:

- **They call `preventDefault()` after firing the send, unconditionally.** If the hand-off
  fails, the click is already swallowed and the user has nothing. Our transactional
  interception (`handleDownloadCreated`) sets a higher bar — preserve it here.
- **A non-capture listener** loses to any page that stops propagation first. Capture phase
  costs nothing and is strictly more reliable.

Worth taking: the protocol-list generalisation (`magnet:` is not the only download-only
scheme), and the bounded-depth ancestor walk. Also worth knowing before estimating: their own
source carries the comment that true protocol handling for extensions does not exist and this
listener trick is the only option — so there is no cleaner API to go looking for.

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

**Prior art — two hard-won lessons from clients that survived a firmware break**

- **Namespace the error codes, don't flatten them.** Established clients key vendor errors by
  API group (`common`, `Auth`, `DownloadStation.Task`, …) rather than one flat table, because
  the same numeric code means different things per endpoint. Directly relevant here: a
  `common` code meaning *"the requested API does not exist"* is exactly the signal a firmware
  update produces, and it is only distinguishable once codes are namespaced. That is a
  cheaper, earlier detector than shape-sniffing the payload, and the two complement each
  other — catch the explicit code where the NAS sends one, fall back to envelope detection
  where it does not.
- **Do not trust the NAS's own capability declaration.** A client that tried to negotiate by
  asking the device which API versions it supports found the new firmware *misreporting* its
  support, and had to fall back to attempting a version and reacting to the
  unsupported-version error instead. So: probe and react, never believe a declaration. This
  is the difference between a card that works after the next QTS release and one that repeats
  a known failure.

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

**No prior art to lean on (checked 2026-08-31).** The mature open-source client in this
category implements neither a queue nor any deferred-send mechanism, and the extension that
advertises offline queuing is closed-source. So there is no established shape to follow here:
the design below is ours, and the risks in it are unproven rather than known-solved. Budget
accordingly — this is the card most likely to need a second pass after real use.

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

**No prior art (checked 2026-08-31):** no toast-with-action or undo mechanism exists in the
comparable open-source client — its removals are immediate, like ours. Nothing to copy; the
infrastructure question below is genuinely ours to answer.

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

### RES-1 — Verify on a live NAS how `AddUrl` handles a magnet URI

**Size:** S · **Area:** api/research · **Status:** Backlog
**Files:** none yet — this card produces findings, not code
**Blocks:** GAP-1 (the hand-off path it will use)

Magnet reaches Download Station through a **different and much simpler path** than a
`.torrent`, and confirming its exact behaviour is worth doing before GAP-1 is implemented.

**Why the path differs.** A `.torrent` is a file Chrome has already begun downloading, which
is why `handleDownloadCreated` has to be transactional — pause, hand off, cancel only on
success, resume on failure. A magnet is a *string*. There is no `DownloadItem`, nothing to
pause, nothing to cancel, and nothing to lose if the send fails. So GAP-1 shares only the
task-submission code with torrent interception, and none of the download-lifecycle races.

**What is already true (verified, do not re-check):**

- `menus.ts:103` already accepts `magnet:` and routes it through `AddUrl`, so sending a magnet
  from the context menu works today. GAP-1 is about capturing the *click*, not about teaching
  the extension what a magnet is.
- `AddUrl` requires **both** `temp` and `move` (`client.ts:127-139`); omitting either is
  rejected. Verified against a live QTS 5 NAS after it broke once.

**Questions this card answers — on real hardware, not from documentation:**

- [ ] Does `AddUrl` accept a magnet URI with the same `temp`/`move` contract as an HTTP URL,
      or does it want something different?
- [ ] What does the task look like in `Task/Query` immediately after submission, before
      metadata resolves? A magnet has no name until the swarm supplies one — does the popup
      render a blank row, and for how long?
- [ ] Does a **v2 / hybrid** magnet (`xt=urn:btmh:`) get accepted or rejected? QNAP documents
      "BitTorrent / Magnet / DHT" but does not state a libtorrent version or BEP-52 support,
      so this is unknown and only measurable.
- [ ] What happens to a magnet whose swarm never resolves — does the task sit forever, and is
      that distinguishable from a genuine failure in what we display?

**Design consequence to record either way:** validate the **scheme only** (`magnet:`), never
the `xt` prefix. Hard-coding `urn:btih:` would reject v2 magnets that the NAS may well accept
— and whether it accepts them is the NAS's business, not ours. We forward a string; we are not
a BitTorrent client and should not act as a gatekeeper for one.

**Method.** Same as the earlier `AddUrl` verification: submit against the real NAS, read back
`Task/Query`, record the raw payloads in `docs/` next to the existing API findings. No
guessing from vendor documentation — it is what got `temp`/`move` wrong the first time.

---

### RES-2 — Decide whether `ftp://` links are worth supporting

**Size:** S · **Area:** api/research · **Status:** Backlog
**Files:** `src/background/menus.ts` (`isSupportedUrl`)

Download Station accepts HTTP/HTTPS, **FTP/FTPS**, magnet and BitTorrent. Our validator
(`menus.ts:102-110`) accepts only `magnet:`, `http:` and `https:`, so an `ftp://` link is
refused with "Only web and magnet links can be sent to Download Station" even though the NAS
would take it.

The change itself is one line. The question is whether it should be made at all: FTP links in
a browser are close to extinct — Chrome removed FTP support entirely in version 95 — so an
`ftp://` anchor is something the browser itself can no longer open. Adding a branch for it
means carrying code, a test and an error path for a case that may never occur.

**Decide, then act:**

- [ ] Establish whether any real user hits this — an issue, a review, or a concrete site.
- [ ] If yes: extend `isSupportedUrl` and its unit test, and confirm the NAS accepts the URL
      form we pass.
- [ ] If no: close this card as "not needed" and leave the validator alone. Not shipping the
      branch is a valid outcome and should be recorded as one.

Deliberately **not** doing it speculatively: we do not add code for users we have not met.

---

### RES-3 — Establish what the NAS allows for per-task destination folders

**Size:** M · **Area:** api/research · **Status:** Backlog
**Blocks:** GAP-6 (and decides whether the "change it later" half exists at all)

A user wants to choose where a download lands: **when sending**, **while it runs**, and
**after it finishes**. Those are three different questions, and the API answers them very
differently — this card establishes which are possible before anything is designed.

**What the code already tells us (read 2026-08-31, no NAS needed):**

- **At send time — already supported by our own client, just not exposed.**
  `client.addUrl(url, { tempFolder, targetFolder })` (`client.ts:127`) takes a per-call
  target and defaults to `settings.NASdir` only when the caller omits it. `addTorrent`
  likewise sends `move` and `dest_path`. So the plumbing for "choose per download" exists;
  what is missing is UI. That is GAP-6, and it does not depend on this research.
- **After the fact — no endpoint for it.** The full V4 surface we have typed is
  `Add*`, `Query`, `Start`, `Stop`, `Pause`, `Remove`, `Status`, `GetFile`, `SetFile`,
  `Misc/Dir`, `Misc/Login`. There is **no "set destination" call**, and `SetFileRequest` is
  not one: its fields are `hash`, `index`, `priority` — it selects *which files within a
  torrent to fetch*, not where they go.
- **`savepath` does not exist and is silently ignored** (`client.ts:129-130`) — a documented
  trap we already hit once.

**So the honest shape of the feature is probably: choose freely at send time, and after that
the destination is fixed.** Confirm that on hardware before promising anything:

- [ ] Does any undocumented V4 call change a task's destination after creation? Check what
      the Download Station web UI itself sends when a user edits a task — if the UI cannot do
      it either, that settles it.
- [ ] Can `temp` and `move` differ per task without side effects, or does Download Station
      expect one temp folder globally?
- [ ] What happens when `move` names a folder that does not exist or is not writable? Is it a
      clear error, or an accepted task that fails later? `Misc/Dir` reports `writtable` per
      entry, so we may be able to prevent this in the picker rather than discover it after.
- [ ] Does changing the destination of a **completed** task have any meaning, or is moving
      files then purely a File Station operation and out of scope for us?

**If the answer is "no post-hoc move":** say so in the UI rather than hiding the limit. A
disabled control with a one-line reason ("Download Station sets the destination when the task
is created") is better than users hunting for a feature that cannot exist. Record the finding
in `docs/qnap-download-station-capabilities.md` either way — that document exists precisely so
this is not re-investigated.

---

### GAP-6 — No choice of destination at send time

**Size:** M · **Area:** popup/background · **Status:** Backlog
**Files:** `src/popup/features/folderPicker/` (reuse `FolderSelect`);
`src/background/menus.ts`; `src/api/client.ts` (already parameterised)

Every download goes to the single `NASdir` from Settings. A user with more than one kind of
download — a film, a distro, a work file — has to open Settings, change the folder, send, and
change it back. Competitors expose this per download: *NAS Download Manager* lists "Download a
link to a specific folder" and *Send To QNAP++* ships pattern-based folder routing.

**We are closer to this than it looks.** `addUrl`/`addTorrent` already accept a per-task
target; only the UI is missing. And we already have the hard part of the UI: `FolderSelect`
validates a path against the NAS through `Misc/Dir` and knows which folders are writable.

**Note the overlap with F3 (routing rules), which is also unbuilt.** Routing rules answer
"always send this *kind* of thing here" automatically; this card answers "send *this one*
there" manually. They are complements, and both use the same per-task target. Whichever is
built first should expose that plumbing so the second does not rebuild it.

**Acceptance criteria**

- [ ] The send flow offers a destination, pre-filled with the configured default, without
      making the common case slower — a user who does not care must not gain a step.
- [ ] The chosen folder is validated before the task is created, using the existing
      `Misc/Dir` writability check rather than a free-text field.
- [ ] A per-send choice never silently rewrites the default in Settings.
- [ ] Context-menu sends are covered too, not just the popup — that is where most sends
      happen, and it has no UI surface today.
- [ ] Interception (`handleDownloadCreated`) keeps working with no prompt: a browser-initiated
      `.torrent` must not start blocking on a dialog.

**The unresolved design question, and it is the whole card:** interception is *automatic*.
There is no natural moment to ask, and a modal on every download would ruin the feature that
the demo is built around. Options are a default-with-override (send immediately, offer to
re-route from the popup — depends on RES-3), a per-send choice only where a UI already exists
(context menu, popup), or routing rules (F3) doing this without asking at all. **Settle this
before writing code**; the wrong answer here makes the product worse.

---

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
- **aria2 (or any second backend).** Proposed as a way to gain aggressive multi-connection
  downloading and one extension for every link type. Rejected on four grounds, recorded here
  so it is not re-proposed: it breaks **single purpose**, the most common CWS rejection reason
  — "send to QNAP Download Station" is one clear purpose, "…or to aria2" is two integrations
  to justify at review; the audience collapses, since Download Station ships with the NAS
  while aria2 needs Entware or a container, and anyone who can install it can already type
  `aria2c -x 16`; the cost is a second API client, a second settings schema, a second task-state
  model and a doubled e2e matrix; and it is not our product to own — we are a Download Station
  client, and the right answer to "I want a multi-connection downloader" is aria2 with its own
  frontend.
- **Multi-connection / segmented downloading.** Not ours to influence in either direction. We
  hand the NAS a URL; how many connections it opens is its decision, and no parameter we can
  send changes it. Whether Download Station segments a single HTTP file is unknown and, for
  the extension, immaterial.
- **RSS / broadcatching, download scheduling, bandwidth limits.** Real Download Station
  features that live on the NAS and are configured there. Reimplementing a NAS control panel
  in a browser popup is not what this extension is for.
- **BT search in the popup.** Download Station's own search is widely reported broken by
  QNAP's users; wrapping someone else's broken feature inherits their bug reports.
