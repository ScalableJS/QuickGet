---
type: "task"
id: "BUG-46"
status: "done"
priority: "p1"
area: "core/routing"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Routing type detection disagrees with the send-path detector, so `.torrent` rules miss tracker links

**Severity:** high · **Area:** core/routing
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
