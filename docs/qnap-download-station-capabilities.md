# QNAP Download Station — what it can do, and what we use

What the NAS-side application supports, and which of it QuickGet Remote exposes. Written so a
feature request ("can it do X?") can be answered without re-reading vendor documentation, and
so we do not build something the NAS already does.

**Two rules this document exists to enforce:**

1. **Vendor documentation is a hypothesis; the NAS is the authority.** `AddUrl` is documented
   as taking a URL, and our first implementation did exactly that — it failed, because the
   endpoint also requires `temp` and `move`. Anything marked *unverified* below has not been
   tested against real hardware and must not be built on.
2. **We are a client, not a downloader.** We hand Download Station a string. Everything about
   how it fetches — connections, DHT, peer exchange, retries — happens on the NAS and is not
   something the extension can influence with any parameter.

## Source formats

| Format | Download Station | QuickGet Remote | Notes |
|---|---|---|---|
| `.torrent` file | yes | yes | Intercepted from the browser's download, uploaded via `SetFile`. The transactional path in `handleDownloadCreated`. |
| `magnet:` (`urn:btih:`, v1) | yes | **partly** | Accepted from the context menu (`menus.ts:103`) and sent via `AddUrl`. Clicks are *not* captured — that is GAP-1. |
| `magnet:` (`urn:btmh:`, v2/hybrid) | **unverified** | forwarded as-is | QNAP documents "BitTorrent / Magnet / DHT" without naming a libtorrent version or BEP-52. See RES-1. We validate the scheme only, never the `xt` prefix, so a v2 magnet is passed through rather than rejected by us. |
| `http:` / `https:` | yes | yes | Ordinary direct downloads already work from the context menu — this is not a missing feature. |
| `ftp:` / `ftps:` | yes | **no** | `isSupportedUrl` rejects it. Deliberately open — see RES-2. Chrome removed FTP support in v95, so such a link is not something the browser can open either. |

## Transfer behaviour — on the NAS, not ours

DHT, peer exchange, trackerless torrents, private trackers and proxying are all Download
Station's own behaviour. A magnet resolves to peers through DHT without us supplying a
`.torrent`, which is why the magnet path is structurally simpler than torrent interception:
no file, no `DownloadItem`, no pause/cancel/resume.

**Connection count and segmentation are not exposed to API callers.** Whether Download Station
splits a single HTTP file across ranges is undocumented and, for this extension, immaterial:
there is no parameter we could send to change it. Requests for "download like IDM / Download
Master" cannot be satisfied from here — see the rejected aria2 proposal on the gaps board.

## NAS-side features we deliberately do not mirror

RSS / broadcatching, BT search, download scheduling and bandwidth limits are real Download
Station features, configured on the NAS. They are not gaps in the extension. BT search in
particular is widely reported broken by QNAP's own users; wrapping it would inherit their bug
reports without fixing anything.

## Destination folders — what the API does and does not allow

Read from the typed V4 surface on 2026-08-31; the post-creation half still needs hardware
confirmation (RES-3).

| Moment | Possible? | Notes |
|---|---|---|
| Choose when creating the task | **yes** | `addUrl(url, { tempFolder, targetFolder })` and `addTorrent` both take a per-task target and only fall back to `settings.NASdir`. The client is already parameterised — what is missing is UI (GAP-6). |
| Change while the task runs | **no endpoint known** | The typed V4 surface has no "set destination" call. |
| Change after completion | **no endpoint known** | Likely a File Station operation, outside Download Station's API and outside this extension. |

Two traps recorded so they are not rediscovered:

- **`SetFile` is not what its name suggests.** Its fields are `hash`, `index`, `priority`: it
  chooses *which files inside a torrent to download*, not where they land.
- **`savepath` does not exist.** It is accepted and silently ignored — the destination travels
  as `temp` + `move` (and `dest_path` for the multipart torrent upload).

The practical consequence: the destination is almost certainly **fixed at creation time**.
If RES-3 confirms it, say so in the UI rather than leaving users to hunt for a control that
cannot exist.

## Verified API facts

Findings confirmed against a live QTS 5 NAS. These are the ones that have already cost us a
bug, so they are recorded rather than rediscovered:

- **`AddUrl` requires both `temp` and `move`.** Omitting either is rejected
  (`src/api/client.ts:127-139`). This applies to magnets as well as HTTP URLs.
- **Session expiry is body-level, not HTTP-level.** `{"error":5,"reason":"session error"}`
  with a 200 status; handled by the single-flight re-login in `src/api/index.ts`.
- **Task states are numeric and non-obvious.** 104 downloading, 100 seeding, 2 stopped
  (`src/lib/tasks.ts:174`). Do not infer them from names.

## Open questions

Tracked as cards in
[`../agent-os/product/competitive-gaps-kanban.md`](../agent-os/product/competitive-gaps-kanban.md):

- **RES-1** — how `AddUrl` behaves with a magnet: the `temp`/`move` contract, what
  `Task/Query` shows before metadata resolves, and whether a v2 magnet is accepted.
- **RES-2** — whether `ftp://` support is worth the branch.
- **GAP-1** — capturing magnet *clicks*, which the context menu does not cover.
