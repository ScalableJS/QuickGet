# Competitive gaps — Kanban

Gaps found by comparing our shipped behaviour against what competing QNAP/Synology
Download Station clients do, and against what *their users complain about*. Analysis and
sources: [`../../docs/competitor-analysis.md`](../../docs/competitor-analysis.md); feature
detail: [`../../docs/feature-roadmap.md`](../../docs/feature-roadmap.md).

Task files are canonical; this document keeps board context, historical notes, and stable card links.

---

## Board

Open [the task board](../../views/tasks.base) and filter `board` by `competitive-gaps`.
The frontmatter of [task files](../../tasks/README.md) owns status.

## Cards

### GAP-1 — `magnet:` clicks are never intercepted

[GAP-1](../../tasks/GAP-1.md) — canonical task and status.

### GAP-2 — A NAS firmware change reads as "no downloads", not as a fault

[GAP-2](../../tasks/GAP-2.md) — canonical task and status.

### GAP-3 — Offline queue: links are lost when the NAS is asleep

[GAP-3](../../tasks/GAP-3.md) — canonical task and status.

### GAP-4 — No undo on remove

[GAP-4](../../tasks/GAP-4.md) — canonical task and status.

### GAP-5 — Listing does not claim the maintenance gap

[GAP-5](../../tasks/GAP-5.md) — canonical task and status.

### RES-1 — Verify on a live NAS how `AddUrl` handles a magnet URI

[RES-1](../../tasks/RES-1.md) — canonical task and status.

### RES-2 — Decide whether `ftp://` links are worth supporting

[RES-2](../../tasks/RES-2.md) — canonical task and status.

### RES-3 — Establish what the NAS allows for per-task destination folders

[RES-3](../../tasks/RES-3.md) — canonical task and status.

### GAP-6 — Destination choice is missing from the paths that send most downloads

[GAP-6](../../tasks/GAP-6.md) — canonical task and status.

### RES-4 — Can File Station move a finished download, and at what cost to seeding?

[RES-4](../../tasks/RES-4.md) — canonical task and status.

### GAP-14 — Re-route a download after it has started — which windows actually exist

[GAP-14](../../tasks/GAP-14.md) — canonical task and status.

### RES-6 — Is there a safe re-route window while a magnet is fetching metadata?

[RES-6](../../tasks/RES-6.md) — canonical task and status.

### GAP-15 — A redirecting download URL is handed to the NAS unresolved

[GAP-15](../../tasks/GAP-15.md) — canonical task and status.

### GAP-16 — Always intercept `.torrent` files, but fall back to the browser on every hand-off failure

[GAP-16](../../tasks/GAP-16.md) — canonical task and status.

### GAP-7 — Global NAS transfer rates in popup header (`↓ 24.8 MB/s ↑ 3.1 MB/s`)

[GAP-7](../../tasks/GAP-7.md) — canonical task and status.

### GAP-8 — Safe task removal dialog with optional data cleanup (`clean: 1 | 0`)

[GAP-8](../../tasks/GAP-8.md) — canonical task and status.

### GAP-9 — Quick speed throttle popover in header (presets: Unlimited, 1, 2, 5 MB/s)

[GAP-9](../../tasks/GAP-9.md) — canonical task and status.

### GAP-10 — Task queue priority management in `⋮` menu (Top, Up, Down)

[GAP-10](../../tasks/GAP-10.md) — canonical task and status.

### GAP-11 — Export `.torrent` file back from NAS via `⋮` menu

[GAP-11](../../tasks/GAP-11.md) — canonical task and status.

### RES-5 — Send an ordinary file download to the NAS on click, any size, behind an off-by-default switch

[RES-5](../../tasks/RES-5.md) — canonical task and status.

### GAP-12 — Private tracker client emulation (`peer_mode`: Transmission, Deluge)

[GAP-12](../../tasks/GAP-12.md) — canonical task and status.

### GAP-13 — Default seeding time and share ratio limits in Settings

[GAP-13](../../tasks/GAP-13.md) — canonical task and status.

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
