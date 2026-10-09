---
type: "task"
id: "ENG-9"
status: "todo"
priority: "p3"
area: "tooling"
board: "engineering"
updated: "2026-10-09"
legacy_status: "Backlog"
size: "S"
execution_order: 8
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
