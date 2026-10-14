---
type: reference
status: active
area: testing
updated: 2026-10-10
features: ["verification-infrastructure"]
---

# Verification layers and what they prove

## Evidence levels

| Layer | Command | Proves | Does not prove |
|---|---|---|---|
| Types and Svelte | `npm run typecheck`, `npm run check:svelte` | Checked contracts/component diagnostics | Runtime NAS semantics |
| Unit | `npm test` | Branches and API/browser-mock call ordering | Browser disk outcome |
| Fixture contracts | Included in `npm test` | Stand/mock behavior on real local sockets | Physical NAS behavior |
| Mock browser E2E | `npm run test:e2e:mock` | Extension interactions and real browser lifecycle against our mock | Unsupported firmware or authenticated NAS URL fetching |
| Deployment unit | `npm run test:deploy` | Upload protocol logic without publication | Store acceptance |
| Real NAS spot check | `npm run test:prod-spotcheck` | Four named scenarios against production `dist` | Every user tracker, firmware, browser, or long-term lifecycle |
| Documentation | `npm run docs:check` | Registry integrity, classification and reviewed snapshot consistency | Product usefulness or automatically discovered behavior inside old files |
| Documentation self-tests | `npm run test:docs` | Checks actually fail on drift, missing links, hidden features, non-English comments and staged mismatch | The accuracy of a human-written review reason |

No coverage percentage merges these evidence levels. The documentation registry links existing evidence files; a file link is not a claim that its suite was run on a particular machine. Dated acceptance sections below identify which local and real-NAS suites were actually executed; documentation review alone does not establish those runtime results.

## Fixtures and hardware ownership

Unit tests use the hand-written Chrome mock and MSW with unhandled requests treated as errors. Fixture tests run separately under Node, with real sockets. The Hono test stand supplies generated torrents and deterministic delivery controls. `overrideGlobalObjects: false` avoids corrupting the API client's Response identity. The mock NAS has an independent contract spec.

The hardware spot check owns tasks by prefix and ledger, records intent before creation, cleans in `finally`, and fails if cleanup fails. It must not touch the user's own tasks. A LAN-bound stand is required when the NAS downloads a direct URL; loopback on the developer's computer is unreachable from the NAS.

## Boundaries of code coverage and static analysis

Vitest coverage excludes declarations, stories, tests, and `index.ts` entrypoints. Therefore its percentage does not cover the whole product, Svelte rendering, or worker wiring. Knip is report-only; no-import findings need direct call-site checks, and globally installed tools such as ffmpeg are not automatically missing product dependencies.

[The test-layer standard](../../agent-os/standards/testing/test-layers.md) and [E2E operations](../../tests/e2e/README.md) remain canonical for detailed procedures.

## Documentation audit verification: 2026-10-09

Executed locally for the English knowledge-base and checker change:

| Command | Actual outcome |
|---|---|
| `npm run typecheck` | Passed |
| `npm run check:svelte` | 0 errors, 0 warnings |
| `npm run lint` | Passed |
| `npm test` | 38 test files, 513 tests passed |
| `npm run build` | Production bundle built |
| `npm run test:deploy` | 28 tests passed |
| `npm run test:e2e:mock` | 45 tests passed |
| `npm run test:docs` | 11 tests passed |
| `npm run docs:check` | Registry, current reviews, classifications and links passed |
| `npm run docs:language` | English-prose guard passed; 12 non-Latin input literals retained |
| `rulesync generate --check` | Generated files are up to date |

No new `test:prod-spotcheck`, Firefox runtime run, Storybook build, store capture or
video recording was executed. Existing evidence links identify their maintained scenarios,
not fresh results from these unexecuted suites.

## Feedback normalization acceptance: 2026-10-09

546 unit/fixture tests, 58 Chromium mock E2E, typecheck, Svelte (0 errors/warnings), lint, production and Storybook builds, and 28 deployment unit tests passed in the integrated env/dev working copy. Configured V8 coverage: statements 88.96%, branches 83.22%,
functions 88.59%, lines 89.57%. The configured exclusions are unchanged;
this is not whole-product or Svelte coverage. [The acceptance audit](notification-normalization-audit.md#accepted-implementation-and-review)
records the deterministic regression matrix and review corrections. Documentation checks and
single-feature reviews accompany the patch. No new physical-NAS, Firefox or publication result
is implied by these local gates.

## Callable quality audit

[The code-quality audit](../quality/code-quality-audit.md) separates automated callable inventory from manual semantic review and permits concise test-fixture any. Use npm run test:quality to exercise AST/Svelte/HTML inventory boundaries, npm run quality:audit for a read-only scan, npm run quality:report for explicit regeneration and npm run quality:check to detect source/report drift. Manual review hashes in docs/quality/reviews.json must reflect an actual source review. These checks do not execute product behavior or certify the NAS.


## Code-quality normalization acceptance: 2026-10-09

Fresh integrated gates passed 571 unit/fixture tests across 40 files, 60 Chromium mock E2E, typecheck, Svelte (zero errors/warnings), lint and production build. [The acceptance record](../quality/code-quality-audit.md#accepted-normalization-2026-10-09) records root rejection/correction probes and scanner review limits. Configured V8 coverage on the final patch: statements 90.86%, branches 84.96%, functions 89.77%, lines 91.56%. The include/exclude rules are unchanged: this measures selected TypeScript modules and excludes Svelte components and index entrypoints; it is not whole-product coverage. No fresh NAS, Firefox or publication result is claimed.


## Final polish hardware evidence: 2026-10-10

The production spot check was executed against the locally configured real NAS after the required-field correction. Six tests passed: preflight, extension connection, torrent acceptance, magnet AddUrl, direct-link fetch/pause/resume/remove, and fixture-prefix ownership. The owned-task ledger was empty after cleanup. This is a real hardware result, distinct from the mock suite and vendor documentation review. It does not publish a release or prove native OS notification display. Final messaging/UI corrective checks are recorded with the integrated acceptance run below.

## Final polish integrated acceptance: 2026-10-10

Final production-bundle hardware checks passed all six spot-check tests with an empty owned-task ledger. Final local integration passed 595 unit/fixture tests across 41 files, 61 Chromium mock E2E, ten consecutive classifier repetitions, typecheck, Svelte (zero errors/warnings), lint, production/dev builds, 26 contrast checks, 28 deployment unit tests, Storybook and Firefox build/lint/package. The genuine extension-reload browser test retains the website and checks exactly one accepted magnet and one Shift-file send. Controlled stale-handler retirement fails without the guard and passes with it.

Configured V8 coverage is 90.94% statements, 84.72% branches, 90.54% functions and 92.00% lines under unchanged selected-TypeScript exclusions. Svelte and index wiring use separate named browser evidence. All 594 current runtime implementations have current manual duplication-review hashes, independently of the test percentages. [The final audit](../quality/code-quality-audit.md#final-integrated-acceptance) records remaining assertion boundaries and review limits. This completes bounded polish, not every future feature, Firefox runtime, OS notification display or store release.

The first pushed polish CI exposed an uncontrolled-time assertion in the transient upload fixture. ENG-25 now installs the browser clock before initialization and separates direct-message priority before 2500 ms from expiry and later poll failures. The fixture passes ten parallel repetitions and all 13 feedback scenarios; removing the source owner guard makes it fail, and restoration passes. Current runtime/NAS evidence is unchanged. [The CI correction record](../quality/code-quality-audit.md#pushed-ci-timer-fixture-correction) preserves the failed run and exact trace times.
