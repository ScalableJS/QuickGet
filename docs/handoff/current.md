---
type: handoff
status: active
area: project
updated: 2026-10-09
---

# Current handoff

The working branch is `env/dev`; production releases use a PR into `env/prod`.
The product version is 2.6.0. [[docs/system/overview|The current overview]] owns shipped behavior;
[task files](../../tasks/README.md) own work status and historical evidence.

The new English knowledge base has a feature registry, explicit review snapshots, independent
source classification, language guard, and CI documentation checks. Read
[[docs/system/documentation|the maintenance workflow]] before changing an owning source.

## Execution and acceptance

[The feedback normalization view](../../views/tasks.base) retains ten canonical cards ordered by
`execution_order`; priority remains separate. Terra implemented the isolated patches and Codex
accepted nine cards after source review, reproduced race probes, Mimic consultation and integrated
checks. 546 unit/fixture tests, 58 Chromium mock E2E, typecheck, Svelte (0 errors/warnings), lint, production and Storybook builds, and 28 deployment unit tests passed in the integrated env/dev working copy.

Current corrections are documented in [[docs/system/feedback|feedback]],
[[docs/system/task-management|task management]], [[docs/system/popup-upload|popup uploads]] and
[[docs/system/settings|settings]]. [The acceptance audit](../system/notification-normalization-audit.md#accepted-implementation-and-review)
preserves coverage limits and red/green evidence. Proven snapshot/UI/helper/dependency cleanup
is complete. The canonical MV3 standard and credential review guidance match current code.

## Code-quality normalization

[The accepted audit](../quality/code-quality-audit.md#accepted-normalization-2026-10-09) records BUG-74 through BUG-76 and ENG-19 through ENG-22. Terra implemented the bounded patches; Codex rejected acceptance loopholes and verified additional storage-read and alarm-clear regressions after consulting Mimic; the final patch preserves current request ownership and separates browser bookkeeping failures. Fresh integrated gates passed 571 unit/fixture tests, 60 Chromium mock E2E, typecheck, Svelte, lint and production build. The refreshed registry inventories 575 runtime implementations with 63 manual family assessments; tests may retain concise fixture any. Configured TypeScript V8 coverage is 90.86% statements / 84.96% branches / 89.77% functions / 91.56% lines, excluding Svelte and index entrypoints. ENG-23 remains discussion until missing code/label vendor evidence is available.

## Next work

- [BUG-71](../../tasks/BUG-71.md) remains partial: measure page/native feedback across new and
  retained tabs and decide the full intent/path policy. Targeted popup completion does not close
  that broader matrix or restore system-success spam.
- [ENG-13](../../tasks/ENG-13.md): decide whether batch URL destinations should evaluate rules per line.
- [ENG-14](../../tasks/ENG-14.md): define Firefox runtime evidence separately from packaging.
- [BUG-70](../../tasks/BUG-70.md): wait for a real recurrence and captured causal sequence.
  No persistent dedupe, history sweep, or guessed restart mitigation is authorized.

[[docs/system/feature-review|The feature review]] is the evidence map for these decisions.
A documentation audit does not publish a release or certify a new real-NAS spot check.
