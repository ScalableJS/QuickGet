---
type: "task"
id: "ENG-5"
status: "done"
priority: "p2"
area: "docs/api"
board: "engineering"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# Replace the stale API README with a short canonical map

**Priority:** P2 · **Size:** S · **Area:** docs/api
**Files:** `src/api/README.md`, `agent-os/standards/api/qnap-download-station-contract.md`

`src/api/README.md` contains broken Quick Start import paths, omits current tests, describes the
checked-in `schema.d.ts` as auto-generated without a generator, and duplicates a QNAP contract
that already has a canonical standard. The document is now more likely to mislead than to help.

**Acceptance:** reduce it to a short module map: public client entrypoint, DTO boundary, checked-in
schema, tests, and a link to the canonical Download Station contract. Examples must compile from
their stated location. Do not copy the `temp`/`move` contract or session-lifecycle prose into a
third source of truth.

**Completed 2026-09-15** — the README is now a short, current module/test map that points to the
canonical contract instead of copying it.
