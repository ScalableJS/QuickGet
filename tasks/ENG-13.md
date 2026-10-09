---
type: task
id: ENG-13
status: todo
priority: p2
area: engineering
board: engineering
updated: 2026-10-09
---

# Decide batch URL destination policy before adding per-line routing

Current `batchUpload.ts` sends URLs through `ApiClient.addUrls()`, which calls `addUrl()` with
one optional target folder and does not invoke `resolveDestination()` per URL. Other send paths
use the routing engine. This is a confirmed difference, not proof that users want it changed.

## Acceptance criteria

- [ ] Decide whether an explicit batch destination wins over per-line rules.
- [ ] Document URL/magnet classification and missing page/name context for this path.
- [ ] If behavior changes, cover mixed URLs and magnets with distinct per-line destinations and fallback.

## Evidence

[Popup upload](../docs/system/popup-upload.md) and [routing](../docs/system/routing-folders.md)
record the current implementation. No runtime change is included in the documentation audit.
