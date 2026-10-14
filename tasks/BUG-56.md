---
type: "task"
id: "BUG-56"
status: "done"
priority: "p3"
area: "testing"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "low"
---

# The test stand advertises cases it cannot exercise

**Severity:** low · **Area:** testing
**Files:** `tests/e2e/fixtures/test-stand/index.html` (tabs "Direct downloads", "Domains & Edge Cases")

Two groups of cards on the stand imply coverage that does not exist:

- **Domains & Edge Cases** links to `https://tracker.example.com/...` and
  `https://eu-west.cdn-network.org/...`, which resolve nowhere. Clicking them in the harness does
  nothing; clicking them manually gives a DNS error. Domain matching is now genuinely covered by
  the second-hostname card on the Tracker tab, so these are pure decoration.
- **Direct downloads** cards carry rule hints like "Pattern `*.mkv` → Movies", but a plain HTTP
  download is never intercepted, so no rule can fire. The stand teaches the opposite of what the
  product does.

Either wire them to something real or relabel them as "not intercepted — this is what a rule
cannot do". The second is arguably more useful: the stand is where someone goes to find out what
the feature does.

**Acceptance criteria**

- [x] No card on the stand implies behaviour the extension does not have.
- [x] Every card is either driven by the matrix spec or explicitly marked as a manual/negative case.
- [x] `docs/routing-coverage.md` and the stand agree.

**2026-09-09 — fixed. **Done 2026-09-09**,** The two links to hosts that resolve nowhere are deleted; domain
matching is demonstrated for real on the Tracker tab, twice. The "Direct downloads" tab and what
is now "URL edge cases" both open with "nothing on this tab reaches the NAS", and every card there
says which rule *cannot* fire rather than which one would. Those cards are worth keeping: the
stand is where someone goes to find out what the feature does, and the edge of a feature is part
of what it does.

**Resolved 2026-09-09** — shipped in v2.3.0.
