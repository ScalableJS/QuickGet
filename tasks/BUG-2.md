---
type: "task"
id: "BUG-2"
status: "done"
priority: "p1"
area: "background"
board: "bugs"
updated: "2026-10-09"
legacy_status: "Done"
severity: "high"
---

# Browser download cancelled before the NAS hand-off succeeds

**Severity:** high · **Area:** background
**Files:** `src/background/downloads.ts:55-56`

`cancelBrowserDownload()` runs before `sendAndNotify()`, and the outcome is never checked.
Any failure after that line leaves the user with no file and no NAS task. Causes silent data
loss on: locked extension, wrong password, NAS offline, timeout, QNAP API error, or a
one-time tracker URL that cannot be fetched twice.

**Root cause:** ordering inherited from the removed `"ask"` mode, where cancelling first was
correct. `2ed381c` deleted the mode and left the `cancel` call in place.

**Fix:** make it transactional — pause → hand off → cancel on success, resume on failure.

**Blocks:** nothing. **Blocked by:** nothing. Do this first; it is the only data-losing defect.
**Done 2026-08-27** — `handOffToNas()` in `src/background/downloads.ts`: pause → send → cancel on
success, resume on failure. Covered by `downloads.test.ts`, which asserts the pause/cancel
ordering via `mock.invocationCallOrder`.
