---
type: "task"
id: "BUG-7"
status: "done"
priority: "p2"
area: "testing"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# No test coverage for `handleDownloadCreated`

**Severity:** medium · **Area:** testing
**Files:** `tests/mocks/chrome.ts`, `src/background/downloads.test.ts` (absent)

The function carrying BUG-2 through BUG-5 has never had a test. A `downloads.test.ts` existed
but only covered `sweepStalePending`, a helper of the `"ask"` mode, and was correctly deleted
with the feature in `2ed381c` — nothing replaced it. `tests/mocks/chrome.ts` has no
`chrome.downloads` or `chrome.notifications` stubs, so the mock must be extended first.

**Fix:** extend the mock; add unit tests asserting call *order* (mode off; success →
pause/send/cancel; locked; empty password; NAS failure → resume; default not persisted).
Then one Playwright spec driving a real download through the mock NAS — that is the only
layer that can prove the browser download actually resumes.

**Sequencing:** write the failing tests against the current code *before* fixing BUG-2, so
the fix is proven.
**Done 2026-08-28** — `tests/mocks/chrome.ts` gained `downloads`/`notifications` stubs and
`createDownloadItem()`; `src/background/downloads.test.ts` covers 18 cases (written against the
old code first: 4 of the first 6 failed). `tests/e2e/download-interception.spec.ts` drives three
real Chrome downloads through a delaying torrent host, including the two original defects: an
unreachable NAS and a missing credential must both leave the file intact. Added to
`test:e2e:mock`, so CI gates on it.
