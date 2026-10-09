---
type: architecture
status: active
area: background
updated: 2026-10-09
features: ["torrent-handoff"]
---

# Browser torrent hand-off

## Recognition and ownership

Browser download events recognize torrents from MIME type, browser-derived filename, URL suffix, or the known opaque `dl.php` source fallback when contrary metadata is absent. `onCreated` and `onChanged` may observe one download; a synchronous, operation-scoped ID claim elects one sender. Chromium's filename callback can defer the save decision until the hand-off finishes.

Torrent processing is unconditional when configuration and live NAS login permit it. No user switch is needed to enable torrents. The ordinary-file setting does not own or reclassify them. The transaction verifies configuration and a live login before fetching the torrent. It uploads through the shared torrent sender, resolves routing from the release name, and only then cancels/erases the browser download after NAS acceptance. Duplicate-torrent acceptance is handled as an already-owned NAS task. Every earlier exit releases deferred browser handling.

## Tracker access

The sender prefers a page-context fetch with the source referrer when an appropriate page exists, falling back to worker fetch for sources that need no page session. An HTTP success alone is insufficient: a tracker login HTML page must not be uploaded as torrent content. Content-Disposition supports extended UTF-8 filenames; torrent metadata supplies the actual name used for routing.

This is browser-mediated fetching of a small torrent descriptor. It is distinct from ordinary large-file URL download, which the NAS fetches itself. The extension does not send the browser's whole cookie jar to the NAS.

## Failures and lifetime

Configuration, authentication, tracker, and NAS send failures leave normal browser behavior available. A cancellation failure after NAS acceptance can leave a browser copy; the code prefers that over losing the user's download. Failure notifications are throttled by episode. Claims and deferred filename callbacks are in memory for the current worker operation; they are not persistent cross-restart deduplication.

[BUG-70](../../tasks/BUG-70.md) records intermittent reappearance of a deleted NAS task after a complete browser restart. No reproduced cause permits a restart-history mitigation. A clean mock suite is not proof that this observation is resolved.

## Sources and evidence

- [downloads.ts](../../src/background/downloads.ts), [torrentSender.ts](../../src/lib/torrentSender.ts), [tabFetch.ts](../../src/lib/tabFetch.ts), [torrentMeta.ts](../../src/lib/torrentMeta.ts).
- [Download interception E2E](../../tests/e2e/download-interception.spec.ts), [tracker guard E2E](../../tests/e2e/hotlink-guard.spec.ts), and corresponding unit tests verify request ownership, fallback, and browser file outcomes.
- [Real-NAS spot check](../../tests/e2e/prod-spotcheck.spec.ts) exercises the production bundle before releases; no new hardware run is claimed by this documentation audit.

## Accepted handoff and feedback bookkeeping

After NAS acceptance, clearing the previous failure episode is best-effort bookkeeping. A rejected
session-storage cleanup is logged without changing acceptance or preventing browser cancellation.
Pre-acceptance send failures still preserve the browser transfer. The regression injects cleanup
rejection after one mocked `AddTorrent` acceptance; it is not a physical-NAS observation.
