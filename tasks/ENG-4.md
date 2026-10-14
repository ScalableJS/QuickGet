---
type: "task"
id: "ENG-4"
status: "review"
priority: "p2"
area: "CI/release"
board: "engineering"
updated: "2026-10-09"
legacy_status: "In Review"
size: "M"
---

# Stop rebuilding the same Chrome and Firefox artifacts in one workflow run

**Priority:** P2 · **Size:** M · **Area:** CI/release
**Files:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `package.json`

CI runs `build:firefox` and then `package:firefox`, whose script runs `build:firefox` again. Deploy
runs a production Chrome build before `test:e2e:mock` rebuilds `dist-dev`, then
`package:chrome`/`release` performs the production build again. These are measured graph
duplicates, not the deliberate validation of both production and development artifacts.

**Acceptance:** keep standalone package commands safe for local use, add explicit package-from-
existing-dist commands for workflows, and ensure each target artifact is built once per job.
Production Chrome must still build before publication; mock E2E must still build and load
`dist-dev`; Firefox lint and the uploaded Firefox archive must inspect the same `dist-firefox`
created earlier in the job. Record before/after workflow duration when the change first runs.

**Moved to In Review 2026-09-15** — workflows now package existing production/Firefox output and
standalone package commands still build first. Local packaging and all 45 mock E2E scenarios pass;
the first CI/deploy run still needs its before/after duration recorded.
