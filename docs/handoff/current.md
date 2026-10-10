---
type: handoff
status: active
area: project
updated: 2026-10-10
---

# Current handoff

The working branch is `env/dev`; production releases use a PR into `env/prod`.
The product version is 2.6.0. [[docs/system/overview|The current overview]] owns shipped behavior;
[task files](../../tasks/README.md) own work status and historical evidence.

The new English knowledge base has a feature registry, explicit review snapshots, independent
source classification, language guard, and CI documentation checks. Read
[[docs/system/documentation|the maintenance workflow]] before changing an owning source.

## Execution and acceptance: 2026-10-09

[The feedback normalization view](../../views/tasks.base) retains ten canonical cards ordered by
`execution_order`; priority remains separate. Terra implemented the isolated patches and Codex
accepted nine cards after source review, reproduced race probes, Mimic consultation and integrated
checks. 546 unit/fixture tests, 58 Chromium mock E2E, typecheck, Svelte (0 errors/warnings), lint, production and Storybook builds, and 28 deployment unit tests passed in the integrated env/dev working copy.

Current corrections are documented in [[docs/system/feedback|feedback]],
[[docs/system/task-management|task management]], [[docs/system/popup-upload|popup uploads]] and
[[docs/system/settings|settings]]. [The acceptance audit](../system/notification-normalization-audit.md#accepted-implementation-and-review)
preserves coverage limits and red/green evidence. Proven snapshot/UI/helper/dependency cleanup
is complete. The canonical MV3 standard and credential review guidance match current code.

## Code-quality normalization: 2026-10-09

[The accepted audit](../quality/code-quality-audit.md#accepted-normalization-2026-10-09) records BUG-74 through BUG-76 and ENG-19 through ENG-22. Terra implemented the bounded patches; Codex rejected acceptance loopholes and verified additional storage-read and alarm-clear regressions after consulting Mimic; the final patch preserves current request ownership and separates browser bookkeeping failures. Fresh integrated gates passed 571 unit/fixture tests, 60 Chromium mock E2E, typecheck, Svelte, lint and production build. The refreshed registry inventories 575 runtime implementations with 63 manual family assessments; tests may retain concise fixture any. Configured TypeScript V8 coverage is 90.86% statements / 84.96% branches / 89.77% functions / 91.56% lines, excluding Svelte and index entrypoints. At that acceptance ENG-23 retained missing vendor evidence; the subsequent polish resolves it below.

## Current polish acceptance: 2026-10-10

Terra implemented the bounded patches in shared ownership sets, Mimic provided substantive source review, and Codex reproduced/adjudicated findings and accepted the final integration. BUG-64/65/66/71/77/78/79 and ENG-23/24/25 are done. Notification/page ownership, gray attention acknowledgement, serialized native episodes, read-only settings defaults, required torrent move serialization, vendor error labels, control contrast and genuine retained-tab reload are documented in their canonical system pages.

Fresh final evidence: 595 unit/fixture tests, 61 Chromium mock E2E, ten classifier repetitions, six real-NAS spot checks with an empty owned-task ledger, types/Svelte/lint, production/dev/Storybook builds, 26 contrast checks, 28 deployment tests and Firefox package checks. Current manual semantic evidence covers all 594 runtime implementations; tests may retain pragmatic any. Coverage and external limits are recorded in [[docs/system/verification|verification]] and [the final audit](../quality/code-quality-audit.md#final-integrated-acceptance). All changes belong to env/dev; version 2.6.0 and release/store state are unchanged.

## Separate future work

- [ENG-13](../../tasks/ENG-13.md): decide whether batch URL destinations should evaluate rules per line.
- [ENG-14](../../tasks/ENG-14.md): define Firefox runtime evidence separately from packaging.
- [BUG-70](../../tasks/BUG-70.md): wait for a real recurrence and captured causal sequence; no persistent dedupe, history sweep or guessed restart mitigation is accepted.

These are separate decisions/evidence tasks and do not reopen the completed polish. [[docs/system/feature-review|The feature review]] retains their rationale. The first pushed polish CI exposed a transient-success timing fixture; ENG-25 fixes clock ordering while preserving priority, expiry and subsequent poll visibility. Its source-guard counter-check fails without protection and passes after restoration. Repository CI must be checked against the pushed env/dev revision; local results alone are not a CI outcome.
