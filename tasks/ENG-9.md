---
type: "task"
id: "ENG-9"
status: done
priority: "p3"
area: "tooling"
board: "engineering"
updated: "2026-10-09"
legacy_status: "Backlog"
size: "S"
execution_order: 9
depends_on:
  - ENG-15
---

# Remove redundant direct development dependencies

**Priority:** P3 · **Size:** S · **Area:** tooling
**Files:** `package.json`, `package-lock.json`

The Knip baseline confirmed no source/config import of `chrome-webstore-upload`; the deployment
script implements the Store API directly. `@storybook/svelte` is already a normal dependency of
`@storybook/svelte-vite`, and `@unocss/preset-wind4` is already provided by `unocss`, which is
the package imported by `uno.config.ts`. They are redundant direct dev dependencies.

**Acceptance:** remove only those three direct dev dependencies, regenerate the lockfile, and
verify `npm run build-storybook`, `npm run build`, and `npm run test:deploy` still pass. Do not
replace the hand-written Store uploader with the removed package.


**2026-10-09 execution priority:** order 8 in the feedback normalization view. Cleanup follows verified behavioral fixes. Recheck production consumers before removing code; preserve live neighboring helpers and API duplicate semantics.

**2026-10-09 assignment:** Terra prepares the bounded cleanup in an isolated verified-cleanup worktree. Root acceptance waits for behavioral gates and independent review; no task is closed by assignment alone.

**2026-10-09 review:** the root reviewer inspected the six-file, 82-line deletion. No retained package version changed; transitive Svelte/Wind4 and ambient Chrome types remain. Terra passed 513 tests, 45 mock E2E, typecheck/Svelte/lint, production and Storybook builds, and 28 deployment tests. Final acceptance awaits the integrated feedback gates.


**2026-10-09 root acceptance:** Removed only the three proven redundant direct dependencies. Lockfile retains other package versions, transitive packages and ambient Chrome types. Clean installation and production/Storybook/deployment checks passed. Terra implemented the patch; Codex inspected the actual diff, challenged it with reproduced ordering failures and consulted Mimic. 546 unit/fixture tests, 58 Chromium mock E2E, typecheck, Svelte (0 errors/warnings), lint, production and Storybook builds, and 28 deployment unit tests passed in the integrated env/dev working copy. See [accepted evidence](../docs/system/notification-normalization-audit.md#accepted-implementation-and-review). These are mocked/browser results; no fresh physical-NAS or Firefox certification.
