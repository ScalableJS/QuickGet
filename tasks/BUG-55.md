---
type: "task"
id: "BUG-55"
status: "done"
priority: "p3"
area: "testing"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "low"
---

# Routing edge cases have no test at the level that can reach them

**Severity:** low · **Area:** testing
**Files:** `src/background/menus.test.ts`, `tests/e2e/routing-matrix.spec.ts`

**Written first as "the context-menu path has no coverage", which is wrong — corrected the same
day after reading `menus.test.ts`.** `handleContextMenuClick` is exported and unit-tested through
MSW, including *"routes the fetched torrent to the folder its rule selects"*, which asserts the
`move` field out of the multipart body. The context-menu path is covered where it can be covered
cheaply; what is missing is only Chrome's real menu wiring, and that needs a test seam in a
production build to reach. Not worth it.

What is actually uncovered is a handful of edge cases, all of which fit in the existing unit
suite with no new machinery:

- **quick-add is *supposed* to bypass rules** — nothing asserts it, so a future change could
  quietly make it obey them and nobody would notice until a user's explicit folder choice stopped
  winning.
- **a valid-MIME torrent whose bencode is unreadable**, falling back to `DownloadItem.filename`
  (`readTorrentName` returns `undefined` — unit-covered in isolation, never through a send).

**Acceptance criteria**

- [x] The two cases above are asserted at the unit level, on the destination folder rather than
      on success.
- [x] `docs/routing-coverage.md`'s "cannot cover" table drops the rows these close, and keeps
      Chrome's native menu with the reason it stays out.
- [ ] No test seam is added to production code for this.

**2026-09-09 — trimmed from four cases to two.** Dropped: the non-ASCII name, already covered in
`torrentMeta.test.ts` at the level that actually parses it; and the successful login-walled fetch,
because `hotlink-guard.spec.ts` proves the fetch and the folder is chosen by exactly the same code
as every other torrent send. What is left is the two that guard something nothing else does — a
deliberate bypass that a future "fix" could silently remove, and a fallback path never exercised
through a real send.

**2026-09-09 — fixed, In Review.** Both cases assert the destination folder, not merely success:

- `menus.test.ts` — an unreadable `.torrent` on the context-menu path degrades to the URL's own
  name, which for a `.torrent` link names the metadata file. The test asserts it lands in the
  `torrent` rule rather than the `mkv` one, so the limit is written down instead of rediscovered.
- `downloads.test.ts` — the interception path *does* have a name to fall back to, the one Chrome
  derived from `Content-Disposition`, and a `dl.php` download with an unreadable torrent still
  routes on it.

Quick-add's deliberate bypass is left unasserted after all: `CreateUrls.svelte` contains no
rule-resolution code, so a test there would restate that it passes its own folder and would not
catch the regression the card feared.

**Resolved 2026-09-09** — shipped in v2.3.0.
