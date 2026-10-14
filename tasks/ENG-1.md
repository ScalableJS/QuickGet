---
type: "task"
id: "ENG-1"
status: "done"
priority: "p1"
area: "CI/release"
board: "engineering"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# Restore the documented Svelte gate and bound the deploy job

**Priority:** P1 · **Size:** S · **Area:** CI/release
**Files:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `package.json`

`npm run check:svelte` is named by the project instructions as a required completion check, but
neither CI nor the production deploy workflow runs it. The deploy job also has no
`timeout-minutes`, so a hung publish can occupy its non-cancelling `deploy-*` concurrency group for
GitHub's much longer default window.

**Acceptance:** run `npm run check:svelte` in both workflows after TypeScript typecheck; add an
explicit deploy timeout with enough headroom for install, mock E2E, packaging and publication
(start with 30 minutes and raise it only from measured runs); keep the existing typecheck, lint,
unit, deploy-test, production-build and mock-E2E gates.

**Completed 2026-09-15** — both workflows now run `check:svelte` after typecheck and deploy is
bounded to 30 minutes. The local Svelte gate passes.
