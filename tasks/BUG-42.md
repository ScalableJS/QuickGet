---
type: "task"
id: "BUG-42"
status: "done"
priority: "p1"
area: "core/routing"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Routing rules parser edge cases: case-sensitive .torrent, fragile magnet dn parsing, unhandled URI errors, and domain normalization

**Severity:** high · **Area:** core/routing
**Files:** `src/lib/routingRules.ts`, `src/lib/routingRules.test.ts`

Audit of `src/lib/routingRules.ts` revealed silent routing failures and unhandled runtime exceptions:
1. **Case-sensitive extension in `classifyUrl`:** `stripQueryAndHash(url).endsWith(".torrent")` is case-sensitive and misses `.TORRENT` or `.Torrent`. Similarly, `MAGNET:` scheme should be handled case-insensitively.
2. **Fragile `magnet dn=` parsing in `getFilename`:** `param.split("=")` splits on the first `=` only, dropping content if the filename contains `=` (e.g., base64 chunks or titles with `=`). It also manually re-implements percent decoding and `+` replacement instead of using standard `URLSearchParams`.
3. **Double `decodeURIComponent` exception in `getFilename`:** If a URL is syntactically valid but contains a malformed percent-sequence (e.g., `foo%ZZ.mkv`), `decodeURIComponent` throws `URIError`. The `catch` block attempts `decodeURIComponent(lastSegment)` a second time *outside* a try-catch, causing an unhandled crash. Safe fallback should return the raw segment.
4. **Sanitizer vs Resolver semantic mismatch:** `sanitizeRoutingRules` allows whitespace-only `destination: "   "`, but `resolveDestination` skips it because `rule.destination.trim() === ""`.
5. **Empty string conditions in storage:** If a rule has `domain: ""` or `namePattern: ""` in storage, `resolveDestination` checks `rule.domain !== undefined` or `rule.namePattern !== undefined`, treating an empty string as an active impossible condition (e.g. `/^$/`) that can never match.
6. **Domain matching edge cases:** Domains pasted with protocol (`https://example.com`), trailing slashes (`example.com/`), or trailing dots (`example.com.`) fail to match incoming URLs.
7. **Condition policy:** A rule requires at least one condition (`type !== "all" || domain.trim() || namePattern.trim()`) AND a non-empty `destination.trim()`. Catch-all rules without conditions are prohibited in the UI (users configure the global Target folder setting instead).

**Resolved 2026-09-08** —
1. `src/lib/routingRules.ts`: Switched magnet query parsing in `getFilename` to `URLSearchParams`, correctly preserving `=` in filenames and decoding pluses.
2. Added `safeDecodeURIComponent` fallback to return raw string without throwing `URIError`.
3. Added `normalizeDomain` stripping `https?://`, trailing slashes, dots, and lowercasing.
4. Hardened `classifyUrl` to handle uppercase `.TORRENT` and `magnet:` case-insensitively.
5. In `sanitizeRoutingRules`, trimmed empty strings to `undefined` and discarded whitespace-only destinations.
6. Consolidated all 8 edge cases into passing assertions in `src/lib/routingRules.test.ts`.
