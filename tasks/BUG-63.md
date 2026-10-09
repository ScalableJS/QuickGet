---
type: "task"
id: "BUG-63"
status: "done"
priority: "p2"
area: "testing"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "medium"
---

# Shift-click E2E captures its baseline before the first download reaches disk

**Severity:** medium · **Area:** testing
**Files:** `tests/e2e/routing-matrix.spec.ts:386`

`Shift-click sends a link even with every automatic mode switched off` failed once on GitHub
Actions during the v2.4.3 release, at `expect.poll(() => readdir(downloadsPath))`.

The first attempt's log names the cause exactly:

```
Error: expect(received).toHaveLength(expected)
Expected length: 0
Received length: 1
Received array:  ["big_buck_bunny_1080p.mkv.torrent"]
- Timeout 10000ms exceeded while waiting on the predicate
```

The test plain-clicks a `.torrent` with both interception modes off, asserts the browser kept it,
and snapshots `localDownloadCount` as the baseline. It took that snapshot the moment
`chrome.downloads.search()` reported one item — but Chrome registers a download **before** its
bytes reach the disk, so on a loaded runner `readdir` answered `[]` and the baseline was recorded
as **0**. The first download's file landed a moment later, and the assertion after the Shift-click
then waited 10 s for a directory to hold zero files while holding one, which it never would.

Two things this rules out, both worth stating because both were the obvious first guesses:

- **Not a product regression.** The received file is the *plain* click's download, not a leftover
  from the Shift-click. The preceding assertion — that `chrome.downloads.search()` count is
  unchanged — passed, so the Shift-click created no download at all. The mock-NAS log shows
  `Misc/Login` and `Task/AddTorrent` both answering 200. The v2.4.3 change touched no background,
  content-script or interception code.
- **Not a poll budget that is too small.** An earlier version of this card said so and proposed
  raising the timeout. That was wrong: the expected value was captured incorrectly, so no timeout
  is long enough. A bigger budget would have made the failure slower, not rarer.

Establishing that it was a test defect rather than a product one took three runs of the same
commit `f116a5c`: the pull_request run passed 41/41, the push run failed 1/41, and the re-run of
that push passed. Locally it passed 6/6 in ~1.7 s — a fast disk never opens the window, which is
why this is a CI-only failure.

**Fixed** by waiting for the first download to reach `state === "complete"` before snapshotting,
so the baseline describes a settled directory. What the test asserts is unchanged — BUG-60 added
these local-outcome assertions precisely so the test could not pass without proving the real
browser outcome, and that is still what they do.

**2026-09-13 — done.** Shipped on `env/dev` after v2.4.3. Verified 5/5 locally plus
`test:e2e:mock` 41/41.
