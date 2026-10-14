---
type: "task"
id: "RES-6"
status: "deferred"
priority: "p2"
area: "api/research"
board: "competitive-gaps"
updated: "2026-10-09"
legacy_status: "Deferred"
size: "M"
---

# Is there a safe re-route window while a magnet is fetching metadata?

**Size:** M · **Area:** api/research
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
