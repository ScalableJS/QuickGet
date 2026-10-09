---
type: reference
status: active
area: testing
updated: 2026-10-09
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

No coverage percentage merges these evidence levels. The documentation registry links existing evidence files; a file link is not a claim that its suite was run on a particular machine. The local quality gates are run for this change, while a new real-NAS test is outside this documentation audit.

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
