# Competitive gaps — Kanban

Gaps found by comparing our shipped behaviour against what competing QNAP/Synology
Download Station clients do, and against what *their users complain about*. Analysis and
sources: [`../../docs/competitor-analysis.md`](../../docs/competitor-analysis.md); feature
detail: [`../../docs/feature-roadmap.md`](../../docs/feature-roadmap.md).

**Columns:** `Backlog` → `In Progress` → `In Review` → `Done`.
Move a card by editing its Status cell; add a dated line under the card when the status
changes.

**Two prefixes live on this board.** `GAP-n` is a thing a competitor does that we do not;
`RES-n` is a question that has to be answered before a gap can be sized. Both are real open work
— count both when asking what is left, or the research cards silently vanish from the total.

A card only belongs here if a competitor does something we do not, **and** there is
evidence a user wants it. Parity for its own sake is not a goal — several deliberate
non-features are recorded at the bottom so they are not re-litigated.

---

## Board

| ID | Gap | Area | Size | Status |
|----|-----|------|------|--------|
| GAP-1 | `magnet:` clicks are never intercepted | background/content | M | Done |
| GAP-7 | Global NAS transfer rates in popup header (`↓ 24.8 MB/s ↑ 3.1 MB/s`) | popup/ui | S | Done |
| GAP-8 | Safe task removal dialog with optional data cleanup (`clean: 1 | 0`) | popup/ui | S | Rejected |
| GAP-9 | Quick speed throttle popover in header (presets: Unlimited, 1, 2, 5 MB/s) | popup/ui | M | Backlog |
| GAP-10 | Task queue priority management in `⋮` menu (Top, Up, Down) | popup/ui | S | Done |
| GAP-11 | Export `.torrent` file back from NAS via `⋮` menu | popup/ui | S | Deferred |
| GAP-12 | Private tracker client emulation (`peer_mode`: Transmission, Deluge) | settings/api | S | Backlog |
| GAP-13 | Default seeding time and share ratio limits in Settings | settings/api | S | Backlog |
| RES-5 | Send an ordinary file download to the NAS on click, any size, behind an off-by-default switch | background/content | L | Backlog |
| GAP-2 | No survival story for a QTS firmware upgrade | api | M | Backlog |
| GAP-3 | Offline queue — links are lost when the NAS is asleep | background | M | Backlog |
| GAP-4 | No undo on remove | popup/ui | M | Backlog |
| GAP-5 | Listing does not claim the maintenance gap left by the segment leader | store | S | Backlog |
| RES-1 | Verify on a live NAS how `AddUrl` handles a magnet URI | api/research | S | Backlog |
| RES-2 | Decide whether `ftp://` links are worth supporting | api/research | S | Backlog |
| RES-3 | Establish what the NAS allows for per-task destination folders | api/research | M | Rejected |
| GAP-6 | Destination choice is missing from the paths that send most downloads | popup/background | S | Rejected |
| RES-4 | Can File Station move a finished download, and at what cost to seeding? | api/research | M | Rejected |
| GAP-14 | Re-route a download after it has started — which windows actually exist | api/background | L | Rejected |
| RES-6 | Is there a safe re-route window while a magnet is fetching metadata? | api/research | M | Deferred |
| GAP-15 | A redirecting download URL is handed to the NAS unresolved | background/api | S | Backlog |

---

## Cards

### GAP-1 — `magnet:` clicks are never intercepted

**Size:** M · **Area:** background/content · **Status:** Done (2026-09-04)
**Files:** `src/content/magnet.ts`; `src/background/magnetHandler.ts`; `manifest.json` + `manifest.firefox.json`;
`src/lib/config.ts` (`DEFAULTS`); `src/popup/features/settings/Settings.svelte`; `tests/e2e/magnet-interception.spec.ts`

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

- [x] With `autoCaptureMagnets` on, a left-click on `<a href="magnet:?xt=...">` sends the URI
      to the NAS and no external application is launched.
- [x] With the setting off, no listener is attached and the click behaves exactly as today.
- [x] Toggling the setting takes effect in already-open tabs without a reload
      (`chrome.storage.onChanged`).
- [x] Modified clicks (middle-click, ⌘/Ctrl-click) and non-primary buttons are left alone.
- [x] A magnet click while the NAS is unreachable surfaces the same error path as a
      `.torrent` hand-off, and does **not** silently swallow the navigation (isolated Shadow DOM toast feedback with `[Open locally]` and `[Retry]`).
- [x] Firefox parity is decided explicitly: `manifest.firefox.json` includes `src/content/magnet.ts`.

**Resolution & Implementation Notes (2026-09-04)**
- Implemented with *Synchronous Cancellation + Compensating Fallback* pattern (consulted with ChatGPT Gateway): DOM event dispatch cannot await promises before calling `preventDefault()`. Cancellation is synchronous in capture phase; failures trigger an isolated Shadow DOM toast (`#quickget-feedback-host`) providing user-initiated fallback to open locally (`window.location.href`) or retry.
- Security: Enforces `event.isTrusted === true` to block synthetic script clicks from untrusted origins.
- Robust traversal: Uses `event.composedPath()` to support nested elements, icons, and Web Components / open Shadow DOM.
- Reuses existing routing rules engine (`classifyUrl`, `resolveDestination`) to preserve destination folder mapping.
- Full E2E coverage via mock NAS (`tests/e2e/magnet-interception.spec.ts`) and unit tests (`magnet.test.ts`, `magnetHandler.test.ts`). Existing `.torrent` flow completely unaffected.

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

**Size:** M · **Area:** api/research · **Status:** Rejected
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

**2026-09-09 — the question was too narrow.** A routing review asked the same thing from the
other end and found a window this card does not consider: a magnet sits in state 103 with
`files: 0` and nothing downloaded while Download Station fetches its metadata, and `Task/Query`
carries a `source_name`. If the real name becomes readable there, the destination can be
corrected by removing and re-adding at zero cost — no move, no File Station, no seeding risk,
because no payload exists yet. That is RES-6. This card keeps its original scope: whether
Download Station can change `move` on an existing task. GAP-14 is the umbrella that says which
of the three windows we actually intend to use.

**2026-09-09 — corroborated from the outside.** No competitor calls anything resembling a
destination change; the census is in `docs/competitor-routing-teardown.md` section E. That is not
proof the call does not exist, but it removes "surely someone does it" as a reason to keep
looking. What is left worth checking on hardware is the `move`-points-at-a-missing-folder question
in the list above, which is a validation concern rather than a re-routing one.

**2026-09-09 — narrowed to one question.** The re-routing part is settled: GAP-14 is rejected,
RES-4 is rejected, and no competitor has a destination-change call either. What is still worth a
minute on hardware is the *validation* question from the list above, which has nothing to do with
moving anything:

- What does Download Station do when `move` names a folder that does not exist or is not writable
  — a clear error, or an accepted task that fails silently later? `Misc/Dir` reports `writtable`
  per entry, so a bad destination could be caught in the picker instead of discovered afterwards.

Everything else on this card is answered. Retitle it if it is picked up.

**2026-09-09 — Rejected; the last open question is answerable without hardware.** It had been
narrowed to "what does Download Station do with a `move` that does not exist or is not writable".
Three things already answer it well enough to not spend a NAS session:

- The editor validates the folder through `Misc/Dir` when the rule is written (F1), so the path
  existed at least once.
- The residual case is a folder deleted on the NAS afterwards — rare, and not preventable by us.
- Download Station reports it: `++`'s error table carries `6: "Destination folder not found"`, and
  we have displayed task error codes since BUG-37.

So the failure is already surfaced to the user in words. Confirming the mechanism on hardware would
change nothing we would build.

---

### GAP-6 — Destination choice is missing from the paths that send most downloads

**Size:** S · **Area:** popup/background · **Status:** Rejected
**Files:** `src/popup/features/folderPicker/` (reuse `FolderSelect`);
`src/background/menus.ts`; `src/api/client.ts` (already parameterised)

**This card was originally written as "no choice of destination at send time", which is
wrong — corrected 2026-08-31 after reading the code.** Two mechanisms already exist:

- **Routing rules are shipped** (F3, not "unbuilt" as an earlier version of this card said).
  `resolveDestination` runs in the context-menu path, in `.torrent` interception
  (`downloads.ts:293`) and in the Chooser pre-fill, matching on URL, domain or task name.
- **Quick-add in the popup already has a folder picker** — `CreateUrls.svelte` renders a
  `FolderSelect` seeded with the configured target, and deliberately bypasses rules so an
  explicit choice wins.

So the real gap is narrower, and mostly about the automatic path: when a `.torrent` is
intercepted and no rule matches, it goes to `NASdir` with no opportunity to say otherwise, and
nothing after the fact can change it (RES-3/RES-4). A user whose download went to the wrong
folder has no recourse inside the extension.

**What is actually missing**

- [ ] A way to influence the destination of an *intercepted* download, which is the path with
      no UI at all today.
- [ ] Somewhere to see which folder a task was sent to, so a wrong destination is noticed
      before the download finishes rather than after.

**The unresolved design question, and it is the whole card:** interception is *automatic*.
There is no natural moment to ask, and a modal on every download would ruin the feature the
demo is built around. Given that routing rules already handle the "always send this kind of
thing there" case well, the honest options are narrow: surface the chosen folder and let the
user re-route *before* the task is created (a brief undo-style window), or accept that
interception follows rules and settings only, and put the effort into making the destination
visible instead. **Settle this before writing code** — the wrong answer here makes the product
worse, and the cheapest good answer may be "show, do not ask".

**Acceptance criteria**

- [ ] The destination an intercepted task was given is visible to the user without opening
      Settings.
- [ ] Whatever is added does not slow the common case: a user who does not care must not gain
      a step, and interception must never block on a dialog.
- [ ] Any folder offered is validated through the existing `Misc/Dir` writability check rather
      than free text.
- [ ] A per-send choice never silently rewrites the default in Settings.
- [ ] Routing rules keep priority where they match; this must not become a second, competing
      mechanism for the same decision.

**2026-09-09 — the "show, do not ask" half now has a card.** UX-20 covers surfacing the folder a
task was given *and* which rule chose it, using `move`/`path` that `Task/Query` already returns.
The re-route half is scoped by GAP-14, which splits it into the windows that actually exist. The
duplicated closing paragraph below is drift from an earlier edit — the two copies say the same
thing.

**The unresolved design question, and it is the whole card:** interception is *automatic*.
There is no natural moment to ask, and a modal on every download would ruin the feature that
the demo is built around. Options are a default-with-override (send immediately, offer to
re-route from the popup — depends on RES-3), a per-send choice only where a UI already exists
(context menu, popup), or routing rules (F3) doing this without asking at all. **Settle this
before writing code**; the wrong answer here makes the product worse.

**2026-09-09 — Rejected; both halves resolved elsewhere.** The card's own text called the design
question "the whole card": interception is automatic, so there is no natural moment to ask, and a
modal per download would ruin the feature. That question is now moot rather than answered.

- **"Ask" is unnecessary.** The reason to ask was that rules routinely got it wrong, and they did
  because they matched on the URL. They now match on the release name and the originating site, so
  the automatic answer is usually the right one.
- **"Show" is BUG-38**, which stays open and is one field: `Task/Query` already returns `move` and
  `path`.

Nothing is left that this card would carry on its own.

**2026-09-09 — and the "show" half is now Done too** (BUG-38): the destination is on every task
card, folded to its last two segments with the full path in the tooltip. Nothing is left of this
card in any form.

---

### RES-4 — Can File Station move a finished download, and at what cost to seeding?

**Size:** M · **Area:** api/research · **Status:** Rejected
**Depends on:** RES-3 (which confirms Download Station itself has no move call)

Download Station's own API has no set-destination call, but **File Station is a separate API
on the same NAS** and does move files. So "change the folder after the fact" is probably
achievable — just not through the downloader, and not without a consequence the user must be
told about.

**The consequence, which is the whole point of this card.** Moving a completed torrent's files
out from under Download Station detaches them from the task: the task still points at the old
path, so **seeding breaks**, and depending on how the task reacts, a recheck may fail or the
task may re-download. For a private tracker that is not cosmetic — broken seeding costs ratio,
and ratio loss can cost the account. Any UI we build here has to say this *before* the move,
not explain it afterwards.

**Prior art worth noting:** the mature open-source client in this category integrates File
Station but uses only its **read** endpoints (`Info`, `List`) — it browses folders and never
moves anything. That is a deliberate-looking boundary, and a reason to be careful rather than
to assume it is easy.

**Questions, in the order that decides whether we build anything:**

- [ ] Does File Station's move/copy API exist on QTS 5 in a form we can call with the same
      session, or does it need its own login? We currently authenticate only against
      `/downloadstation/V4/Misc/Login`.
- [ ] What are the **permission** implications? File Station move is a far broader capability
      than "add a download" — a user may reasonably not want a browser extension able to move
      arbitrary files on their NAS. This is the strongest argument for not doing it at all.
- [ ] What actually happens to an active or seeding task when its files move? Does Download
      Station error, silently stop, or re-download? Test with a *completed but seeding* task,
      not just a finished one.
- [ ] Is there a safe subset — for example, only offering the move for a task that is
      finished **and not seeding** — that gives most of the value with none of the ratio risk?

**Design position to hold whatever the answers are:** if this ships, it ships as an explicit,
warned, one-way action on a specific task — never as a silent "change destination" that looks
like editing a setting. The warning must name the real consequence ("this will stop seeding
and detach the task from its files"), not a generic "are you sure?".

**Do not build this to satisfy a UI symmetry.** The reason to want it is a real user with a
full disk or a misfiled download; the reason to refuse is that we would be handing a browser
extension the ability to move files anywhere on the NAS. Weigh both before writing code, and
record the decision either way.

**2026-09-09 — probably answerable without ever calling File Station.** Two cheaper windows
were identified upstream of this one (GAP-14): routing a `.torrent` on the real content name
before the task is created, and correcting a magnet's destination during the metadata stall
(RES-6). If those land, the remaining File Station case is "the user changed their mind after
bytes were written", which is rare enough that the permission cost argued for above almost
certainly wins. Do GAP-14 first and re-read this card afterwards — it may close as Rejected
rather than being built.

**2026-09-09 — Rejected.** The reason to build it was "the user changed their mind after the fact".
The reason not to is unchanged and now better supported: it means granting a browser extension the
ability to move arbitrary files on the NAS, and moving a completed torrent's files detaches the
task and breaks seeding, which on a private tracker costs ratio.

What tipped it: routing on the real content name (BUG-47) removes most of the "wrong folder"
cases this was meant to repair, and the endpoint census found that the one competitor holding File
Station credentials uses exactly one function, `func=stat`, and never moves a file
(`docs/competitor-routing-teardown.md` section E). Nobody in this category does it, the cost is a
permission the user should not have to grant, and the need shrank.

Reopen only for a concrete user report of a full disk or a misfiled download that routing could
not have prevented.

---

### GAP-14 — Re-route a download after it has started — which windows actually exist

**Size:** L · **Area:** api/background · **Status:** Rejected
**Umbrella for:** BUG-47 (name source), RES-6 (magnet metadata window), RES-3 and RES-4 (the
post-hoc move), GAP-6 (making the destination visible at all)

"Change the folder after the download started" is one sentence describing three different
problems with three different answers. This card exists so the product decides which of them
it is promising, before any UI implies all three.

**Window 1 — before the task is created. Free, and we are not using it.**
For a `.torrent` the browser already holds the file: `sendTorrentUrlToNas` fetches the blob and
sniffs its first two bytes. The info dictionary's `name` is the real content name, so the rule
that decides the destination can be evaluated against the actual release rather than the URL
slug. No NAS call, no new permission, no risk. This is the single biggest improvement available
and it is tracked as BUG-47.

**Window 2 — the metadata stall, magnets only. Plausible, unproven.**
A magnet enters Download Station in state 103 with `files: 0` and no payload while metadata is
fetched. If the resolved name surfaces in `Task/Query.source_name` during that window, the
destination can be corrected by `Remove` + `AddUrl` with the right `move` — nothing has been
downloaded, so nothing is lost. Needs hardware confirmation: RES-6.

**Window 3 — after bytes have landed. Expensive, and probably never.**
Download Station has no set-destination call (RES-3). Only File Station can move the files, and
that detaches the task, breaks seeding, and costs ratio on a private tracker — plus it means
granting a browser extension the ability to move arbitrary files on the NAS (RES-4).

**Design position to hold.** Windows 1 and 2 are *routing decided before any bytes land*, not
moving. Never present them as "move the folder" — that phrasing promises window 3, and a user
who believes it exists will go looking for it after the download completes, which is the one
moment we cannot help them. If window 3 stays closed, say so in the UI with a reason, the way
RES-3 already argues.

**Acceptance criteria**

- [ ] The product states explicitly which windows exist, and the UI copy matches.
- [ ] No control or wording implies a capability the API does not have.
- [ ] Whatever ships is verifiable by the user before it matters — see UX-19.

**2026-09-09 — window 1 shipped; window 3 is now closed on evidence.** The `.torrent` half of
window 1 is implemented (BUG-47): `readTorrentName` reads `info.name` out of the file we already
fetch, and the destination is resolved against it. An endpoint census of all three competing
Firefox clients found no post-add destination call anywhere — *Send To QNAP++* holds File Station
credentials and uses exactly one function, `func=stat`, to check a folder exists. Nobody moves a
file. Treat window 3 as closed unless RES-3 turns up something on hardware, and say so in the UI
rather than leaving a hole where a control looks like it should be. Full census:
`docs/competitor-routing-teardown.md` section E.

**2026-09-09 — Rejected, with one window shipped and one deferred.** The product owner excluded
post-hoc moves outright ("send to one folder then move it when it finishes — leave that out").
That was the right call and the card can close, but only because the useful part of it was not
that window:

- **Window 1 shipped.** A `.torrent` is routed on its own `info.name`, read from the bytes the
  browser already fetched (BUG-47), and a magnet on the page it was clicked on. No moving
  required; the destination is simply correct the first time.
- **Window 2 deferred** to RES-6 — hardware-blocked, and adjacent enough to the excluded idea that
  it does not get revived without a reason.
- **Window 3 rejected** — RES-4.

The design position stands and is why this closes cleanly rather than lingering: windows 1 and 2
are *routing decided before any bytes land*, not moving. Nothing in the UI should suggest
otherwise.

---

### RES-6 — Is there a safe re-route window while a magnet is fetching metadata?

**Size:** M · **Area:** api/research · **Status:** Deferred
**Depends on:** RES-3 · **Feeds:** GAP-14 window 2, BUG-47 (magnet half)

A magnet is the case where routing is weakest — the only name available at send time is the
optional `dn` parameter — and also the case where the NAS learns the real name a few seconds
later. This card establishes whether that gap can be used.

Recorded from earlier hardware work: a magnet parks in state 103 with `files: 0` until metadata
arrives, and `Task/Query` exposes `source_name` alongside `move`, `path`, `progress` and
`down_size` (`src/api/schema.d.ts:40-71`).

**Questions, in the order that decides whether anything gets built:**

- [ ] Does `source_name` change from the magnet URI to the real torrent name once metadata
      resolves, and is there any other field that carries it sooner?
- [ ] Is state 103 reliably "metadata only" — do `progress` and `down_size` stay at 0 until
      metadata is in, so a re-add provably discards nothing?
- [ ] What does `Remove(clean=1)` + `AddUrl` of the same magnet at that moment cost? Re-announce
      delay, tracker rate-limiting, a duplicate task, a changed hash in the task list?
- [ ] How long is the window in practice, and what happens if metadata never resolves — does the
      task have to be left where it was, and is that visible to the user?

**Known blocker on our own hardware.** Magnets do not resolve metadata at all on
`192.168.88.185` — both test magnets sat in state 103 with `files: 0` for minutes (2026-06-19),
which looks like no outbound UDP/DHT. This research needs either a NAS with working DHT or a
magnet whose tracker is reachable over HTTP; a `.torrent` upload is not a substitute, because
its metadata is already embedded and the window under test never opens.

**If the answer is no,** magnet routing is permanently limited to `dn`, and UX-18 must say so
plainly rather than leaving users to discover it one silent non-match at a time.

**2026-09-09 — Deferred.** Blocked on hardware: magnets do not resolve metadata at all on
`192.168.88.185`, so the window this card is about never opens where we can watch it. It is also
adjacent to the post-hoc move the owner excluded, which means it does not get picked up
opportunistically.

Its value is narrow but real and unclaimed: it is the only path by which a magnet could ever be
routed on its actual content name. Everything else about magnets is already handled — `dn` when
present, the originating page's domain when not.

---

### GAP-15 — A redirecting download URL is handed to the NAS unresolved

**Size:** S · **Area:** background/api · **Status:** Backlog
**Files:** `src/api/client.ts` (`addUrl`), `src/background/menus.ts`, `src/background/magnetHandler.ts`

*Send To QNAP++* fetches a link itself and forwards `response.url` — the address after redirects —
rather than what the user clicked, with a comment naming a real case (`itorrents.org` redirecting
to `itorrents.net`) where Download Station's own fetcher does not follow and the task lands dead
(`plus/SendLink.js:566-570`, `docs/competitor-routing-teardown.md` section F).

Our `.torrent` path is already immune: we fetch in the browser and upload the file, so a redirect
is resolved before the NAS ever sees anything. `AddUrl` is not — a plain HTTP link goes to the NAS
exactly as the page wrote it. Magnets are unaffected.

**Establish before building.** It is not known whether QNAP's fetcher follows redirects; if it
does, this is nothing. A HEAD or ranged GET before `AddUrl` costs a round trip on every ordinary
download, so it is only worth it if the failure is real.

**Acceptance criteria**

- [ ] Confirmed on hardware whether Download Station follows a 30x on an `AddUrl` target.
- [ ] If it does not, the URL is resolved before sending, without adding a request to the common
      case where no redirect occurs.
- [ ] A dead task caused by a redirect is distinguishable from a dead task caused by anything
      else — silence here is what makes it expensive.

**2026-09-09 — filed under routing by accident; it is send correctness.** Nothing here depends on
a rule or a destination: a redirecting URL handed to the NAS produces a dead task whatever folder
it was going to. Keeping it in the routing list made that list look longer than it is. Unchanged
otherwise — still small, still gated on one question to a real NAS.

---

### GAP-7 — Global NAS transfer rates in popup header (`↓ 24.8 MB/s ↑ 3.1 MB/s`)

**Size:** S · **Area:** popup/ui · **Status:** Done (2026-09-05)
**Files:** `src/popup/features/toolbar/Toolbar.svelte`, `src/popup/features/toolbar/toolbarView.svelte.ts`, `src/popup/features/downloads/downloadsUI.ts`, `src/api/client.ts` (`getStatus`)

When opening the popup, users currently see individual task speeds, but have no quick visibility
into the total bandwidth consumed by the NAS across all active downloads and background uploads.

**Competitor precedent:** Transmission Easy Client and Synology Download Station show combined
download/upload rates directly in the header (`↓ 12.4 MB/s  ↑ 1.2 MB/s`).

**Acceptance criteria:**
- [x] Header displays total `down_rate` and `up_rate` while tasks are active with semantic arrow colors.
- [x] Displays compact `Idle` text when all rates are 0 B/s.
- [x] Polled only while popup UI is open; does not wake background worker unnecessarily.

---

### GAP-8 — Safe task removal dialog with optional data cleanup (`clean: 1 | 0`)

**Size:** S · **Area:** popup/ui · **Status:** Rejected (2026-09-05)
**Files:** N/A

**Decision (2026-09-05):** Rejected by product direction. Task removal should remove only the task from Download Station's queue by default. Adding extra confirmation dialogs and disk-cleanup checkboxes clutters the interface for marginal value. File deletion belongs in QTS File Station or storage management.

---

### GAP-9 — Quick speed throttle popover in header (presets: Unlimited, 1, 2, 5 MB/s)

**Size:** M · **Area:** popup/ui · **Status:** Backlog
**Files:** `src/popup/features/toolbar/`, `src/api/client.ts` (`Config/Get`, `Config/Set`)

When the NAS saturates the local network connection, users need an instant way to throttle download/upload
speeds without logging into QTS or navigating through deep settings tabs.

**Design rule:** Do NOT use a continuous slider (sliders have poor keyboard UX and massive ranges).
Use a speedometer icon in the header that opens a compact popover with discrete presets:
- Unlimited (`0`)
- 512 KB/s
- 1 MB/s
- 2 MB/s
- 5 MB/s
- 10 MB/s
- Custom...

**Acceptance criteria:**
- [ ] Speedometer icon in header indicates active limit state (subtle accent dot when throttled).
- [ ] Click opens popover with download and upload limit dropdowns.
- [ ] Network request (`Config/Set`) is sent only upon explicit selection/apply, preventing API hammering.

---

### GAP-10 — Task queue priority management in `⋮` menu (Top, Up, Down)

**Size:** S · **Area:** popup/ui · **Status:** Done (2026-09-05)
**Files:** `src/popup/components/downloadItem/DownloadItem.svelte`, `src/popup/features/downloads/downloadsManager.ts`, `src/api/client.ts` (`Task/Priority`), `src/api/schema.d.ts`

QNAP Download Station V4 provides `Task/Priority` (`top`, `up`, `down`). Currently, QuickGet does not
expose queue reordering, forcing users to open QTS if a download needs to be prioritized immediately.

**Design rule:** Do NOT add row arrows (`↑ ↓`) directly to each card (causes visual clutter).
Do NOT implement drag-and-drop (API does not support arbitrary indexing; simulating it triggers racing requests).
Place actions inside the card's `⋮` overflow menu:
- *Move to top* (`priority: "top"`)
- *Move up* (`priority: "up"`)
- *Move down* (`priority: "down"`)

**Acceptance criteria:**
- [x] Priority actions placed in card's `⋮` menu.
- [x] Disabled state when task is already at top or bottom, or when task is finished/stopped.
- [x] Immediate UI refresh on completion.

---

### GAP-11 — Export `.torrent` file back from NAS via `⋮` menu

**Size:** S · **Area:** popup/ui · **Status:** Deferred (2026-09-05)
**Files:** `src/popup/components/downloadItem/DownloadItem.svelte`, `src/api/client.ts` (`Task/GetTorrentFile`)

QNAP Download Station stores the bencoded `.torrent` file for every task and serves it via
`V4/Task/GetTorrentFile?hash=...&sid=...`. Users occasionally need to export an active or completed torrent file.

**Decision (2026-09-05):** Deferred as low priority / niche demand to avoid complicating the `⋮` action menu.

---

### RES-5 — Send an ordinary file download to the NAS on click, any size, behind an off-by-default switch

**Size:** L · **Area:** background/content · **Status:** Backlog — shaped, not started
**Files:** `src/background/downloads.ts`, `src/content/`, `src/lib/config.ts`,
`src/lib/sourceKind.ts`, `src/popup/features/settings/Settings.svelte`
**Related:** GAP-15 (unresolved redirects), RES-2 (`ftp://`), UX-23/UX-24 (the torrent switch and
Shift-click, the shape this copies)

Click a file link — ISO, ZIP, MKV, DMG, anything — and it goes to Download Station instead of
through the browser. **No size threshold: any size.** A checkbox turns it on, and it is **off by
default**.

**2026-09-13 — shaped.** Three decisions were taken and close earlier options on this card:

- **No size threshold.** The earlier draft listed "size-based threshold (e.g. > 500 MB)" as a
  trigger mode, copying *Send To QNAP++*'s configurable 500 MB default. Dropped. A threshold is a
  number the user has to guess at, and it makes the feature fire unpredictably — the same click
  behaves differently depending on a file size nobody checked first.
- **Off by default.** Unlike the torrent switch, this one changes what happens to *ordinary* web
  downloads, so it must be asked for.
- **Extension-based filtering as a user-facing setting is dropped too** — but see open question 3:
  something still has to decide what counts as a file, and that is a different problem from size.

**What already exists, and must not be rebuilt**

- `classifySource()` already returns `"url"`, and the context-menu path already sends a plain URL
  through `AddUrl`. Sending an ordinary file to the NAS is a solved transport — see
  `docs/qnap-download-station-capabilities.md`, which records exactly this. **What is missing is
  only the automatic trigger.**
- Routing rules run on every send path, so a routed destination comes for free.
- `interceptTorrentLinks` in `src/lib/config.ts` plus its checkbox and hint in `Settings.svelte`
  are the shape to copy, including how the hint explains Shift-click.

**The architectural decision that has to come first**

`handleDownloadCreated` **mirrors**: it hands the torrent to the NAS and deliberately keeps the
browser's local copy, because a `.torrent` is a few KB. For a 4 GB ISO that contract is exactly
wrong — mirroring transfers the file twice. So this feature cannot simply widen the
`isTorrentSource()` gate at `downloads.ts:66`; that one-line change would look right and download
everything twice.

Two candidate mechanisms:

**(a) Content script `preventDefault()` on the click** — the mechanism Shift-click already uses.
No bytes ever flow in the browser, so there is nothing to cancel and no partial file. It only sees
clicks on links: a download started by navigation, by script, or one that only reveals itself as a
download after a redirect, is invisible to it.

**(b) `chrome.downloads.onCreated` + cancel** — catches everything Chrome calls a download, but
bytes have already started before anything can act. `downloads.onDeterminingFilename`, which could
hold the download before a file is written, is **not used anywhere in this codebase today** (it
appears only in comments), and Firefox has never implemented it (Bugzilla 1245652).

(a) is the honest default given what is already built; (b) is a possible second net later, not a
starting point.

**Hazards already documented — do not rediscover them**

- *Auth and cookies:* a file behind a login hands the NAS a 401/403 or an HTML login page. The
  `.torrent` path dodges this by fetching in the page's own session and uploading the bytes; a 4 GB
  file cannot be dodged that way.
- *Ephemeral signed URLs:* S3/Cloudflare pre-signed links expire in 30–60 s and can die while the
  task sits in Download Station's queue.
- *Redirects:* **GAP-15** is currently a small `AddUrl` edge case. This feature makes it a
  mainstream one — the two are coupled and should be decided together.

**Open questions — answer before writing code**

1. Mechanism (a) or (b), or (a) now and (b) behind a later decision.
2. **What happens when the NAS refuses.** Silently fall back to an ordinary browser download, or
   say so? `markSendNotice` and `notifier.ts` are the existing precedent for "this needs you".
   Silent fallback is invisible; a notification on every failure is the thing BUG-* cards spent
   effort removing.
3. **What counts as a file.** Not a size question. A click on `<a href="page.html">` must not be
   sent to the NAS. Candidates: the `download` attribute, a known-extension list, `Content-Type`
   from a preflight, or only acting on links Chrome itself would have downloaded. Each has a
   different false-positive profile, and a false positive here sends a web page to the NAS.
4. Does Shift-click keep its current meaning while this is on, or become the escape hatch that
   forces a *local* download?
5. Copy for the checkbox and its hint, sitting next to the torrent one without the two reading as
   duplicates.

**2026-09-13 — phase 1 scoped down: plain links only, no cleverness.** Redirects, signed/expiring
URLs, authenticated downloads and HEAD preflights are all **out of scope for v1**. This removes
the one thing that was a go/no-go: whether Download Station's fetcher follows redirects (GAP-15)
no longer gates this card, it is simply a case v1 does not serve.

One consequence has to be stated rather than assumed, because it is the gap between the intent and
what the code can actually know: **"simple link" is a scope decision, not a detection capability.**
Nothing in a synchronous click handler can tell a direct URL from one that will redirect — that is
only visible after a request, which is exactly the preflight v1 rejects. So a redirecting link
*will* be intercepted and handed to the NAS, and if Download Station cannot fetch it the task fails
there, visibly, like any other bad URL. That is the accepted v1 behaviour: no silent loss, no local
fallback for it, and no attempt to be clever. Resolving redirects before `AddUrl` stays GAP-15's
job, and becomes worth doing once v1 has shown how often people hit it.

**2026-09-13 — consulted, and the open questions above are now answered.** Second opinion taken
through the ChatGPT gateway (`gpt-5.6-sol-high`) with the code facts above. Every claim it made
that this card relies on was re-checked here rather than accepted.

**Q1 — mechanism: (a), and no hybrid.** `downloads.onCreated` is defined as firing once the
download has *begun*, so `cancel()` can only stop something already started — incompatible with
"any size, no bytes in the browser". The third option worth naming and closing:
`webRequest.onBeforeRequest` in blocking mode could cancel before the request leaves, but MV3
allows blocking `webRequest` only for policy-installed extensions, so a Web Store build cannot use
it. `declarativeNetRequest` cannot do a dynamic hand-off.

Explicitly **do not** run (a) and (b) from the same switch. One setting would then mean
"zero-byte intercept" for some downloads and "cancel after start" for others — two contracts
wearing one checkbox, which is the same mistake BUG-62 was about. `onCreated` stays the torrent
path and nothing else.

The `preventDefault()` decision must be synchronous; everything after it need not be.

**Q3 — what counts as a file.** A conservative synchronous classifier:

```
http(s) AND event.isTrusted AND plain primary click on an <a href>
AND ( anchor.hasAttribute("download") OR known extension in the URL *pathname* )
```

The pathname/query distinction is the sharp edge and is directly testable:
`/page?file=movie.mkv` is **not** a file, `/movie.mkv?token=abc` is. Case-insensitive.
Exclude `blob:`, `data:`, `javascript:`, `file:`, `mailto:` — the NAS cannot fetch any of them.

A HEAD preflight for `Content-Type` is rejected for v1: it cannot run inside the click handler,
HEAD often disagrees with GET, and plenty of servers answer 405 or redirect it to a login page.

**Do not intercept `.pdf` by default** unless the anchor carries `download` — the browser
expectation for a PDF link is the viewer, not a file. ISO/ZIP/7z/RAR/DMG/MSI/EXE/APK/IMG/MKV are
the uncontroversial ones.

**Q2 — failure.** After `preventDefault()` the click is gone; "not interfering" is no longer
available, so a fallback has to be started deliberately. Use `chrome.downloads.download({ url })`,
not `location.href` — it carries the host's cookies and returns a `downloadId`. **That id must go
into an ignore set**, or the fallback download is re-intercepted by the torrent path's `onCreated`
listener and the user gets a loop. Pass the anchor's `download` filename through, sanitised.

Two failures that are not the same:

- `AddUrl` itself fails (NAS offline, auth failed, HTTP error) → fall back automatically and say
  so once: *"NAS unavailable — downloading in browser instead."*
- `AddUrl` returns success and the task fails later on the NAS → **no** automatic fallback. The
  task may still recover, and a silent second transfer is a duplicate. This is the existing
  `markSendNotice` / notifier case.

**Q4 — auth and cookies: declared unsupported in v1.** There is no cheap reliable detection. An
unauthenticated HEAD returning 401/403 or a login redirect is a useful *negative* signal, but a
200 proves nothing — GET can behave differently, signed URLs may refuse HEAD, and servers check
`Referer`/UA/IP. Forwarding browser cookies into `AddUrl` is not on the table: QNAP DS V4 `AddUrl`
takes `url`/`temp`/`move`/`sid` and exposes no documented header or cookie channel, and adding the
`cookies` permission plus broad host permissions for an edge case is a real widening of the
security surface for a Web Store extension. The `.torrent` path dodges this only because it can
fetch a few KB in the page's own session and upload the bytes — a 4 GB file cannot be dodged that
way. Write the limitation into the hint text rather than half-solving it.

**Q5 — copy.** The checkbox sits under the existing torrent one; the hint has to carry both the
"any size" promise and the auth limitation without restating the torrent switch.

**GAP-15 becomes a prerequisite-adjacent card, not a neighbour.** Resolving redirects before
`AddUrl` stops being an edge case the moment this ships — see the measured redirect table in the
test plan below.

**Test plan**

Testability is genuinely good here, and specifically because the fixtures already exist:
`tests/e2e/fixtures/test-stand/index.html` already has a **Direct downloads** tab with
`stand-direct-iso` / `-mkv` / `-zip` / `-pdf`, all carrying a `download` attribute, and
`testStandHost.ts` already serves `/files/*` with a real body, a correct `Content-Type`
(`application/x-iso9660-image`, `video/x-matroska`, else `application/octet-stream`) and a
`Content-Disposition`. The mock NAS already logs every request.

What the stand still needs:

1. A file link **without** a `download` attribute (the extension-only path).
2. An extensionless link **with** `download`, and one **without** (must not intercept).
3. `/page.html?next=file.zip` and `/movie.mkv?token=abc` — the pathname-vs-query pair.
4. An ordinary page link, as the plain negative.
5. A `302` file URL, to pin the GAP-15 phenotype.
6. A guarded/`401` file endpoint — `guardedTrackerHost.ts` already refuses hotlinks and is the
   closest existing thing to reuse.
7. A slow or large body (`bodyDelayMs` already exists on the host), so "no bytes flowed" is
   provable rather than merely fast.

E2E scenarios, at minimum: default-off is inert; on + `.iso` sends and downloads nothing locally;
uppercase `.ZIP`; query-string cases both ways; page link not sent; `download`-attribute
extensionless yes / bare extensionless no; PDF not intercepted without `download`; nested
`<a><span>` click; `target="_blank"` produces a task and no new tab; Ctrl/Cmd/middle click left to
the browser; synthetic `el.click()` not intercepted (`isTrusted`); NAS failure produces exactly one
fallback download and one message; the fallback is not re-intercepted; routing rule match and
default destination; `blob:`/`data:` ignored; double-click behaviour decided and pinned; and the
existing torrent click and Shift-click unchanged.

**The strongest success assertion is a triple, not a single one:** NAS `AddUrl` seen once, the
origin file server's GET count for that path **zero**, and `chrome.downloads.search()` from the
service worker showing no new item. That proves no bytes flowed. Asserting only that Playwright
saw no `download` event is weaker than it looks — an extension-initiated
`chrome.downloads.download()` may not belong to that `Page` at all. For the browser-fallback path,
arm `page.waitForEvent("download")` **before** the click.

**Acceptance criteria (draft, to be confirmed once the questions above are answered)**

1. With the switch off, nothing about ordinary downloads changes — this is the default, so it is
   the case that must be provably inert.
2. With the switch on, a click on a direct file link creates a Download Station task and no local
   file, at any size, with no threshold anywhere in the code or the settings.
3. Routing rules apply to it exactly as they do to every other send path.
4. A NAS that refuses or is unreachable leaves the user with the file, not with nothing.
5. A click on an ordinary page is never sent to the NAS.
6. The switch is off in `DEFAULTS`, and a settings import that does not mention it leaves it off.

---

### GAP-12 — Private tracker client emulation (`peer_mode`: Transmission, Deluge)

**Size:** S · **Area:** settings/api · **Status:** Backlog
**Files:** `src/popup/features/settings/Settings.svelte`, `src/lib/config.ts`, `src/api/client.ts`

Private trackers (Rutracker, Gazelle, etc.) frequently blacklist Download Station's default `libtorrent`
peer ID. QNAP Download Station V4 natively includes client emulation in `Config.Set`:
- `0`: Libtorrent default
- `1`: Deluge 1.3.12 (`DE`)
- `2`: Transmission 2.94 (`TR`)
- `3`: uTorrent Mac 1.8.7 (`UM`)

**Design rule:** Lives strictly in `Settings → Advanced`, never in the popup list.

**Acceptance criteria:**
- [ ] Dropdown in Settings allowing selection of client emulation mode.
- [ ] Applied to NAS via `Config/Set` (`bt.peer_mode`).

---

### GAP-13 — Default seeding time and share ratio limits in Settings

**Size:** S · **Area:** settings/api · **Status:** Backlog
**Files:** `src/popup/features/settings/Settings.svelte`, `src/lib/config.ts`, `src/api/client.ts`

Download Station configures seeding stopping conditions via `bt.share_time` (minutes) and
`bt.share_ratio` (ratio limit). Currently, users must configure these directly on the NAS.

**Acceptance criteria:**
- [ ] Settings inputs for default seeding duration (minutes, `-1` for unlimited) and share ratio limit.
- [ ] Reads current values via `Config/Get` and saves via `Config/Set`.

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
- **BT search in the popup (`Addon/Search`).** Download Station's own search plugins (TPB, 1337x, KickAss)
  frequently break due to domain changes; wrapping external discovery into a 380px popup creates
  clutter, requires heavy search result UI, and poses Web Store review risks. The extension is an
  efficient remote downloader, not a torrent discovery engine.
- **RSS automation and channel management (`Rss/*`).** Managing feeds, regex filters, and auto-download
  rules requires a full desktop console; belongs in the native QTS web interface.
- **Filehost premium accounts (`Account/*`).** Managing 3rd party hoster credentials is out of scope.
- **24x7 Schedule grid editor (`schedule0..6`).** Rendering a 168-slot matrix in a popup is an anti-pattern.
- **Drag-and-Drop queue sorting.** QNAP API only supports relative `top`/`up`/`down` movements; drag-and-drop
  would hammer the daemon with racing requests. Priority is handled via the `⋮` menu instead.
