---
type: task
id: BUG-78
status: done
priority: p2
area: settings/interception
board: bugs
updated: 2026-10-10
audit_order: 11
---

# Avoid overwriting newer preferences with stale defaults

The last CI browser classifier scenario failed because the ordinary file reached browser handling rather than AddUrl. Settings loading read missing flags, then persisted a default in a later callback even if the user/test had meanwhile stored a newer choice. This contradicted the module's declared in-memory behavioral-default policy.

Codex's controlled storage interleaving test fails before the correction and passes afterward. The first correction disabled file-flag backfill. A second controlled older-snapshot regression reproduced the same overwrite for HTTPS, port and theme; loadSettings now resolves all defaults in memory without persistence. Existing explicit choices and normalized return values are preserved, while save/migration remain the writers. Browser assertions and timeouts are unchanged.

Final integrated browser/CI acceptance is pending. [The canonical audit](../docs/quality/code-quality-audit.md#final-polish-execution-2026-10-10) owns the source, trace and regression evidence.


## Accepted polish: 2026-10-10

Codex accepted the bounded source/test delta after Terra implementation and substantive Mimic consultation. Fresh integration passed 595 unit/fixture tests, 61 Chromium mock E2E, ten consecutive classifier repetitions, typecheck, Svelte (zero errors/warnings), lint, production build and six real-NAS spot checks; the owned-task ledger is empty. [The final audit](../docs/quality/code-quality-audit.md#final-integrated-acceptance) and [verification](../docs/system/verification.md#final-polish-integrated-acceptance-2026-10-10) retain exact scope and coverage limits. No release or store publication is performed.
