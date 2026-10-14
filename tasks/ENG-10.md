---
type: "task"
id: "ENG-10"
status: done
priority: "p3"
area: "popup/testing"
board: "engineering"
updated: "2026-10-09"
legacy_status: "Backlog"
size: "S"
execution_order: 8
depends_on:
  - ENG-15
  - ENG-16
---

# Remove Knip-confirmed dead UI and test-support code

**Priority:** P3 · **Size:** S · **Area:** popup/testing
**Files:** `src/popup/ui/index.ts`, `src/popup/ui/Card.svelte`,
`tests/e2e/support/actionPopup.ts`, `tests/e2e/support/httpCapture.ts`

No module imports the `Card` barrel export or its component. `isPinnedToToolbar()` and
`persistHttpCapture()` have no callers; their neighbouring `POPUP_SIZE` and
`persistHttpCaptureBundle()` remain live through internal use and the production spot check.

**Acceptance:** remove only the unused Card component/barrel export and the two uncalled helpers;
keep the live neighbouring helpers intact. Run typecheck, unit tests, and mock E2E after removal.


**2026-10-09 execution priority:** order 7 in the feedback normalization view. Cleanup follows verified behavioral fixes. Recheck production consumers before removing code; preserve live neighboring helpers and API duplicate semantics.

**2026-10-09 assignment:** Terra prepares the bounded cleanup in an isolated verified-cleanup worktree. Root acceptance waits for behavioral gates and independent review; no task is closed by assignment alone.

**2026-10-09 review:** the root reviewer inspected the six-file, 82-line deletion. No retained package version changed; transitive Svelte/Wind4 and ambient Chrome types remain. Terra passed 513 tests, 45 mock E2E, typecheck/Svelte/lint, production and Storybook builds, and 28 deployment tests. Final acceptance awaits the integrated feedback gates.


**2026-10-09 root acceptance:** Removed unused Card component/export and two uncalled test helpers. Positive callers of popup sizing and bundled HTTP capture remain intact; integrated checks passed. Terra implemented the patch; Codex inspected the actual diff, challenged it with reproduced ordering failures and consulted Mimic. 546 unit/fixture tests, 58 Chromium mock E2E, typecheck, Svelte (0 errors/warnings), lint, production and Storybook builds, and 28 deployment unit tests passed in the integrated env/dev working copy. See [accepted evidence](../docs/system/notification-normalization-audit.md#accepted-implementation-and-review). These are mocked/browser results; no fresh physical-NAS or Firefox certification.
