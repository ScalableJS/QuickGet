---
type: "task"
id: "BUG-33"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Torrent interception starts before a live NAS connection is established

**Severity:** high · **Area:** background
**Files:** `src/background/downloads.ts`, `src/background/downloads.test.ts`,
`tests/e2e/download-interception.spec.ts`

A complete configuration was treated as sufficient permission to begin interception. The
extension could therefore hold or pause the Chrome transfer and fetch the `.torrent` before it
discovered during `AddTorrent` login that the NAS was offline. Although the transactional path
later resumed Chrome, the download had already been intercepted temporarily; strict no-file mode
could cancel it before learning that the NAS was unreachable.

**Resolved 2026-08-31** — every candidate now performs a live NAS login before QuickGet fetches
the torrent or calls any Chrome transfer mutation (`pause`, `cancel`, `resume`, or `erase`). A
failed preflight releases the filename hold immediately and leaves the original download entirely
to Chrome. The decision is never based on persisted connection health. Unit coverage exercises
both normal and no-local-file modes and proves that a failed preflight performs no tracker fetch
and no download mutation.
