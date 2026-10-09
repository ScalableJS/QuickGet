---
type: "task"
id: "BUG-47"
status: "done"
priority: "p1"
area: "core/routing"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Rules match the URL slug instead of the name the download will actually have

**Severity:** high · **Area:** core/routing
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
