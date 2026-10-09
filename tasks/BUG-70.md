---
type: "task"
id: "BUG-70"
status: "todo"
priority: "p1"
area: "background/QNAP integration"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Backlog"
severity: "high"
---

# Deleted torrent can intermittently reappear on QNAP after a full Chrome restart

**Severity:** high · **Area:** background/QNAP integration
**Files:** `src/background/downloads.ts`, `src/background/index.ts`,
`tests/e2e/download-interception.spec.ts`, `tests/e2e/support/mockNas.ts`

Reported against the real extension on 2026-09-15. Observed sequence: a torrent is sent to
Download Station, its QNAP task is deleted, Chrome is closed with all tabs, and reopening Chrome
can recreate the deleted task without another click. The defect is intermittent and stopped
reproducing during the investigation; that is not evidence that it is resolved.

The trigger and owner are not established. There is no evidence that Chrome replayed a download
event, that the extension issued a second `AddTorrent`, or that Download Station restored the task
itself. The extension has no startup sweep of `chrome.downloads` and production storage does not
retain torrent URLs or task identifiers. None of those facts establishes a cause.

The symptom stopped after reinstalling the application and applying the preceding fixes. That
correlation is not enough to attribute the disappearance to either action, and the current test
environment does not reproduce the issue.

**Diagnostic acceptance:** wait for a real recurrence and first establish whether a second raw
`AddTorrent` request left the browser. Prefer observation outside production code: NAS request
logs, an explicit temporary diagnostic build, or a narrowly scoped reproduction harness. Do not
add persistent production diagnostics, task/download-ID dedupe, history cleanup, or lifecycle
logic merely to make a hypothesis observable.

**Fix acceptance:** establish one evidenced causal sequence, add a regression at the lowest layer
that reproduces it, and change only the boundary proven responsible. No production mitigation is
authorized while the bug remains non-reproducible.

**Returned to Backlog 2026-09-15** — the production diagnostic and speculative restart scenario
were reverted. The issue remains recorded, but it does not block current work and no fix will be
attempted without new evidence.
