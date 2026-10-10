---
type: task
id: BUG-79
status: done
priority: p2
area: content/extension lifecycle
board: bugs
updated: 2026-10-10
audit_order: 12
---

# Restore page interception after an actual extension reload

Codex enabled developer mode in the temporary Chromium profile, allowing the unpacked extension to reload rather than being disabled by the browser. The genuine runtime.reload scenario then failed: a trusted magnet click on the retained website produced zero AddUrl requests. Re-running init in a unit test or directly injecting from the test does not establish this runtime lifecycle.

Terra owns diagnosis and the minimal retained-tab correction. The mandatory browser test keeps the original site open, reloads the extension, then requires exactly one NAS request and accepted page feedback. No skipped test, page reload, arbitrary retry or weakened assertion is accepted. [Page capture](../docs/system/page-capture.md) owns the current contract; [the polish audit](../docs/quality/code-quality-audit.md#final-polish-execution-2026-10-10) records final acceptance.


## Accepted polish: 2026-10-10

Codex accepted the bounded source/test delta after Terra implementation and substantive Mimic consultation. Fresh integration passed 595 unit/fixture tests, 61 Chromium mock E2E, ten consecutive classifier repetitions, typecheck, Svelte (zero errors/warnings), lint, production build and six real-NAS spot checks; the owned-task ledger is empty. [The final audit](../docs/quality/code-quality-audit.md#final-integrated-acceptance) and [verification](../docs/system/verification.md#final-polish-integrated-acceptance-2026-10-10) retain exact scope and coverage limits. No release or store publication is performed.

Codex additionally rejected the initial retirement unit's final-only assertion: it did not establish that the old listener yielded the click. Strengthened assertions require no prevention, propagation stop or send from the stale handler and verify its removal before invoking the current listener. This test fails with the stale-runtime guard removed and passes after restoration. The session-lifetime test verifies one refresh across wakes and a new refresh after reset.
