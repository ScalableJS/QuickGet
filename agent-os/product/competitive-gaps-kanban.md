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
**Files:** new content script; `manifest.config.ts`; `src/lib/config.ts`

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

Already scoped in the roadmap (F4) as a *real gap*: content script at `document_start`,
capture-phase listener on `a[href^="magnet:"]`, `preventDefault`, hand to the NAS. Gate it
behind an `autoCaptureMagnets` setting with live `storage.onChanged` update.

**Blocking question, to settle before writing code:** a content script needs `<all_urls>`,
which is the single most rejection-prone permission in review (see
`docs/competitor-analysis.md` and the CWS permission-justification rules). Decide whether
this ships as an **optional permission** requested on first use rather than a manifest-wide
grant — that keeps the default install narrow and gives review an easy answer.

---

### GAP-2 — No survival story for a QTS firmware upgrade

**Size:** M · **Area:** api · **Status:** Backlog
**Files:** `src/api/index.ts`; `src/popup/features/settings/`

The most damaging failure in this whole product category is not a bug in the extension — it
is a NAS firmware update changing the API underneath it. It has killed competitors outright:

- `seansfkelley/nas-download-manager` #166: DSM 7 broke right-click sending; the maintainer's
  own note — "Synology confirmed they are changing how this extension will have to talk to
  Download Station in DSM 7, but they have declined to specify how or when". The extension
  stayed incompatible for months.
- #147: "unable to connect to DSM after the latest Update … everything was working fine
  until Synology DSM update."
- Reddit /r/qnap on Download Station 5: "Search is completely broken again … I think it
  broke a few months back after a QTS firmware upgrade."

We already handle *session* expiry correctly (single-flight re-login + replay, `api/index.ts`).
This card is about the *other* failure: the API is reachable and authentication succeeds, but
a response shape or field has changed. Today that surfaces as a generic error.

**Deliverable is diagnosis, not a fix** — we cannot pre-empt an unknown API change. Detect a
structurally unexpected response, and say so specifically: "The NAS answered, but not in a
format QuickGet understands — this usually means Download Station was updated." Include the
QTS/DS version we read, and link to the issue tracker. Turning a silent breakage into a
report we receive is worth more than any retry.

---

### GAP-3 — Offline queue: links are lost when the NAS is asleep

**Size:** M · **Area:** background · **Status:** Backlog
**Files:** `src/background/downloads.ts`; `src/lib/config.ts`

*Send To QNAP++* advertises: "Offline Queuing — If your NAS is asleep or unreachable, links
are safely queued and sent automatically when it reconnects." A spun-down NAS is the normal
state for a home user, so this is a real scenario rather than an edge case.

We currently fail the send and surface an error (correctly — BUG-33 made interception wait
for a live connection). The user then has to find the link again.

Design constraint: a queue that fires later must never surprise the user by starting a
download they have forgotten about. Queue with an explicit, visible pending state in the
popup and a way to discard, not a silent background retry.

---

### GAP-4 — No undo on remove

**Size:** M · **Area:** popup/ui · **Status:** Backlog

Already in the roadmap (F4), deferred for a real reason: removal is an immediate NAS call
(`removeDownload` → `client.removeTask`), so a true undo means delaying the call and adding a
toast that can carry an action — our transient `showStatus` banner cannot. Recorded here so
the gap stays visible; blocked on action-capable toast infrastructure.

---

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
the listing currently does not say so. Add it — as verifiable fact (public repo, CI, test
count), never as a claim about a competitor by name.

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
- **BT search in the popup.** Download Station's own search is widely reported broken by
  QNAP's users; wrapping someone else's broken feature inherits their bug reports.
