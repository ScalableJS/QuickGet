---
type: architecture
status: active
area: routing
updated: 2026-10-09
features: ["routing-rules", "nas-folders"]
---

# Routing rules and NAS folders

## Destination selection

A single source classifier distinguishes `url`, `magnet`, and `torrent`. Routing uses that same answer, preventing the sender and matcher from disagreeing about opaque tracker URLs. The first matching sanitized rule wins; unmatched sends use the global Target folder. Each active condition in a rule must match; lists within a condition provide alternatives.

A rule needs a nonempty destination and at least one type, domain, or name condition. Plain name values use case-insensitive substring matching. `*` and `?` are whole-name glob patterns. Conditions accept value lists. Domains can match the source URL host or the originating page host, which is meaningful for magnets even though they have no HTTP host.

For fetched torrents, the release name comes from the bencoded torrent's `info.name`, preferring its UTF-8 variant. Browser filename and URL are fallbacks at the relevant boundary. Local popup torrent uploads use the file's metadata; they have no originating page. The batch URL form passes an explicit destination to `addUrls()`; it does not invoke the rule matcher for each line. That is a documented behavior difference requiring a product decision, not an invented guarantee of identical routing on every path.

## Editor

Settings owns the rule drafts, condition errors, adding/removing, and priority reordering. The editor keeps focus and announces reorder changes. Rules without conditions are not saved as silent catch-alls. Muting, naming, duplication, previews, and a history of rule matches are not implemented features.

## Folder paths and validation

QNAP expects paths relative to the share root. `normalizeFolderPath()` strips the NAS prefix into that form. `Misc/Dir` supplies folder choices and writability metadata. Validation lists the parent and looks for the requested child; missing or read-only is invalid. An unreachable NAS is an unverifiable error, not evidence that a folder is invalid. Empty path handling is separate from the form's required Temp folder rule.

Top-level choices have a five-minute cache tied to endpoint/login identity, with explicit invalidation after settings changes. Folder existence/writability can change after validation; the NAS still decides whether the send succeeds. Both `temp` and `move` belong to the API contract, not merely UI conventions.

## Sources and evidence

- [routingRules.ts](../../src/lib/routingRules.ts), [sourceKind.ts](../../src/lib/sourceKind.ts), [torrentMeta.ts](../../src/lib/torrentMeta.ts).
- [FolderSelect.svelte](../../src/popup/features/folderPicker/FolderSelect.svelte), [validation](../../src/popup/features/folderPicker/validateFolder.ts), [cache](../../src/popup/features/folderPicker/folderCache.ts).
- [Routing coverage](../routing-coverage.md) records test cases; [routing matrix E2E](../../tests/e2e/routing-matrix.spec.ts) and [routing rules E2E](../../tests/e2e/routing-rules.spec.ts) exercise browser send paths.
- [API contract](../../agent-os/standards/api/qnap-download-station-contract.md) owns QNAP temp/move requirements.

Review covers matcher/editor semantics and call sites. It does not make NAS folder permissions permanent or prove every tracker supplies a usable release name.
