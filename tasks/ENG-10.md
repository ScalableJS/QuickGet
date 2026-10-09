---
type: "task"
id: "ENG-10"
status: "todo"
priority: "p3"
area: "popup/testing"
board: "engineering"
updated: "2026-10-09"
legacy_status: "Backlog"
size: "S"
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
