---
type: task
id: BUG-77
status: done
priority: p2
area: API/torrent handoff
board: bugs
updated: 2026-10-10
audit_order: 10
---

# Preserve the required multipart move field for an empty target

The complete semantic review found AddTorrent conditionally omitted move although the declared QNAP V4 contract requires that field. Configuration permits an empty Target, so torrent upload/interception can reach this branch. Codex reproduced the missing request field and now appends move unconditionally, preserving value validation by the NAS and optional dest_path compatibility behavior. The new request-body test fails before the correction and passes afterward; no new required setting or silent folder fallback is introduced.

Final integrated acceptance is pending. [The canonical audit](../docs/quality/code-quality-audit.md#final-polish-execution-2026-10-10) records the reviewed finding and rejected wider proposal.


## Accepted polish: 2026-10-10

Codex accepted the bounded source/test delta after Terra implementation and substantive Mimic consultation. Fresh integration passed 595 unit/fixture tests, 61 Chromium mock E2E, ten consecutive classifier repetitions, typecheck, Svelte (zero errors/warnings), lint, production build and six real-NAS spot checks; the owned-task ledger is empty. [The final audit](../docs/quality/code-quality-audit.md#final-integrated-acceptance) and [verification](../docs/system/verification.md#final-polish-integrated-acceptance-2026-10-10) retain exact scope and coverage limits. No release or store publication is performed.
