---
type: "task"
id: "BUG-44"
status: "done"
priority: "p1"
area: "testing"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Comprehensive regression coverage & post-fix test suite for Routing Rules

**Severity:** high · **Area:** testing
**Files:** `src/lib/routingRules.test.ts`, `tests/e2e/routing-rules.spec.ts`, `tests/e2e/fixtures/test-stand/index.html`, `src/popup/features/settings/RoutingRules.stories.ts`

Comprehensive test suite covering unit, component, Storybook, and E2E regression:
1. `src/lib/routingRules.test.ts`: Consolidated 34 unit tests covering URL/magnet edge cases, draft conversions, draft validation, and domain normalization (all 379 test suite cases passing).
2. `src/popup/features/settings/RoutingRules.stories.ts`: Added 8 dedicated Storybook stories (`EmptyState`, `SingleRule`, `MultiplePrioritizedRules`, `MagnetDisabledDomain`, `ValidationErrorMissingDestination`, `ValidationErrorNoConditions`, `ReorderPriorityInteraction`, `LongPatternsAndDeepPaths`).
3. `tests/e2e/fixtures/test-stand/index.html`: Created interactive test stand with Torrents, Magnets, Direct URLs, and Domains tabs, including live event logger and download triggers.
4. `tests/e2e/routing-rules.spec.ts`: Expanded Playwright suite to 5 tests verifying zero page errors, draft retention on validation error, priority reordering persistence, and live interception against mock NAS with routed destinations.

**Resolved 2026-09-08** —
All test suites green and verified via CI quality gates.


**2026-09-09 — the coverage it added had a blind spot, now closed.** The stand's host served one
shared `sample.torrent` for every `.torrent` link, so all four torrent cards were byte-identical
inside and no test could tell whether routing used the URL or the file. The host now generates a
distinct torrent per link, a "Tracker endpoints" tab carries the shapes a real private tracker
produces (opaque `dl.php`, MIME-only with no filename, multi-file pack, second hostname, magnet
with no `dn`, v2 magnet), and `tests/e2e/routing-matrix.spec.ts` asserts the destination folder
for all twelve. The full picture, including what the stand still cannot reach, is
`docs/routing-coverage.md`.
