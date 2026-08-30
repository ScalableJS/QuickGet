# Tests: map, running, and updating

This document is the working runbook for the project's tests: what test suites exist, where
the key files live, how to run checks safely, how to update tests after a change, and how to
get back into the project after time away without re-exploring the whole repo.

## 1. Quick test map

### Unit / integration (`vitest`)

Run with `npm test`; cover core logic without a browser UI.

Key files:
- `src/api/index.test.ts` — transport / middleware / API request serialization
- `src/api/client.test.ts` — `ApiClient` behaviour: login, query, multipart upload, duplicate handling
- `src/lib/settings.test.ts` — reading and saving settings
- `src/popup/features/downloads/downloadsManager.test.ts` — download list orchestration
- `src/popup/features/downloads/downloadsState.test.ts` — list state and transformation

Unit-test infrastructure:
- `vitest.config.ts` — vitest config
- `tests/setup.ts` — global setup
- `tests/msw/server.ts` — MSW server for network mocks
- `tests/mocks/chrome.ts` — `chrome.*` API mocks
- `tests/fixtures/settings.ts` — test settings factories

### Mock E2E (`playwright`)

Run locally against the built-in mock NAS; never touch a real QNAP.

Key files:
- `tests/e2e/mockNas.contract.spec.ts` — direct `mockNas` contract test, no UI
- `tests/e2e/popup.full-cycle.spec.ts` — full popup happy path in a Chromium extension
- `tests/e2e/support/mockNas.ts` — local mock Download Station API
- `tests/e2e/support/extension.ts` — launches the extension popup
- `tests/e2e/support/popup.ts` — popup UI helpers
- `tests/e2e/support/redactedHttpLog.ts` — redacted request/response log

### Real NAS E2E (`playwright`, opt-in)

Run locally only, and only with explicit environment variables set.

Key files:
- `tests/e2e/popup.real-nas.spec.ts` — read-only smoke + opt-in mutating scenario
- `tests/e2e/support/e2eEnv.ts` — loads env for the real NAS
- `tests/e2e/support/httpCapture.ts` — captures client and network requests
- `tests/e2e/support/realNasClient.ts` — cleans up only the suite's own tasks
- `tests/e2e/support/torrentFixture.ts` — generates a test `.torrent`
- `tests/e2e/README.md` — narrower detail specific to the e2e flow

## 2. What to run most often

### Fast, safe cycle before a commit

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

This safe set:
- never touches a real NAS
- typechecks
- runs unit/integration tests
- builds the extension
- runs mock e2e

### If you only changed TS logic, no UI

```bash
npm run typecheck
npm test
```

### If you changed popup / upload / toolbar / mock NAS

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

### If you only need to run the safe mock E2E explicitly

```bash
npm run test:e2e:mock
```

## 3. Where each area is verified

### Changes in `src/api/*`

Check first:
- `src/api/index.test.ts`
- `src/api/client.test.ts`

Typical reasons to update these tests:
- the request body shape changed
- multipart upload changed
- the login / SID flow changed
- the `Task/Query` shape changed

### Changes in task normalization (`src/lib/tasks.ts`)

Check:
- `src/api/client.test.ts`
- `tests/e2e/mockNas.contract.spec.ts`
- `tests/e2e/popup.full-cycle.spec.ts`

Typical reasons to update these tests:
- new numeric states from QNAP
- new raw job fields
- changes in `normalizeQnap()`

### Changes in the popup UI / download list / toolbar

Check:
- `src/popup/features/downloads/downloadsManager.test.ts`
- `src/popup/features/downloads/downloadsState.test.ts`
- `tests/e2e/popup.full-cycle.spec.ts`

### Changes in the real QNAP payload

Check and update:
- `tests/e2e/support/mockNas.ts`
- `src/api/schema.d.ts`
- `src/lib/tasks.ts`
- `tests/e2e/mockNas.contract.spec.ts`
- `src/api/client.test.ts`

## 4. How to update tests after a functionality change

### Scenario A: changed the mock / API contract

1. Update `tests/e2e/support/mockNas.ts`
2. If the response shape changed, update `src/api/schema.d.ts` as needed
3. If normalization changed, update `src/lib/tasks.ts`
4. Pin the contract in:
   - `tests/e2e/mockNas.contract.spec.ts`
   - `src/api/client.test.ts`
5. Run:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

### Scenario B: changed popup behaviour

1. Update the feature module's unit tests if the logic lives in `src/popup/features/**`
2. Update `tests/e2e/popup.full-cycle.spec.ts` if the user scenario changed
3. If selectors or the popup structure changed, check the helpers in `tests/e2e/support/popup.ts`
4. Run:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

### Scenario C: the real NAS started responding differently

1. Run the real smoke locally, and the mutating flow if needed
2. Save the new captures to `.e2e-artifacts/`
3. Compare the new `.json`/`.log` against the current `mockNas`
4. Update the mock and related tests
5. Repeat the safe mock-only run

## 5. Real NAS: how to run it without breaking your environment

### Read-only smoke

```bash
npm run build
npm run test:e2e:real
```

Only checks:
- saving settings
- test connection
- loading the task list

### Mutating real NAS flow

```bash
npm run build
npm run test:e2e:real:mutating
```

This scenario:
- creates only its own test task, prefixed `quickget-e2e-`
- then deletes it
- additionally cleans up any leftover tasks with that prefix before starting

### Recommended local variables

```dotenv
QNAP_E2E_REAL=1
QNAP_E2E_HOST=...
QNAP_E2E_PORT=...
QNAP_E2E_LOGIN=...
QNAP_E2E_PASSWORD=...
QNAP_E2E_TEMP_DIR=...
QNAP_E2E_DEST_DIR=...
QNAP_E2E_CAPTURE_HTTP=1
```

For the mutating flow, additionally:

```dotenv
QNAP_E2E_ALLOW_MUTATIONS=1
```

### Safety rules

- use a dedicated NAS account for tests
- use dedicated test-owned folders for `TEMP_DIR` and `DEST_DIR`
- never commit real SIDs / tokens / passwords / raw unredacted logs
- only run the mutating flow deliberately

## 6. CI in GitHub Actions

The repo has a `/.github/workflows/ci.yml` workflow that runs on `push` and `pull_request` and
executes the safe set of checks:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

CI never runs real-NAS scenarios and never requires QNAP credentials.

If the browser e2e job fails, the workflow saves `playwright-report/` and `test-results/` as
artifacts.

## 7. How to update the mock from the real NAS

The main update cycle:

1. Run the real smoke locally:

```bash
npm run build
npm run test:e2e:real
```

2. If you need an upload/remove capture, run:

```bash
npm run build
npm run test:e2e:real:mutating
```

3. Look at the artifacts in `.e2e-artifacts/`:
- `real-nas-smoke.log`
- `real-nas-smoke.json`
- `real-nas-mutating.log`
- `real-nas-mutating.json`

4. Compare the real payloads against:
- `tests/e2e/support/mockNas.ts`
- `src/api/schema.d.ts`
- `src/lib/tasks.ts`

5. After updating the mock, always run:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

## 8. Figuring out which test failed and where to look

### `src/api/client.test.ts` failed
Look first at:
- `src/api/client.ts`
- `src/api/index.ts`
- `src/api/schema.d.ts`
- `src/lib/tasks.ts`

### `tests/e2e/mockNas.contract.spec.ts` failed
Look first at:
- `tests/e2e/support/mockNas.ts`
- `src/api/schema.d.ts`
- `src/lib/tasks.ts`

### `tests/e2e/popup.full-cycle.spec.ts` failed
Look first at:
- `tests/e2e/support/mockNas.ts`
- `tests/e2e/support/popup.ts`
- `tests/e2e/support/extension.ts`
- `src/popup/features/**`

### A real NAS spec failed
Look first at:
- env
- NAS reachability
- the current real payload
- `.e2e-artifacts/*.log`
- `.e2e-artifacts/*.json`

## 9. Minimum working file set worth remembering

To get back into the project quickly after time away, starting with these files is almost
always enough:
- `package.json`
- `README.md`
- `tests/README.md`
- `tests/e2e/README.md`
- `.github/workflows/ci.yml`
- `tests/e2e/support/mockNas.ts`
- `tests/e2e/popup.full-cycle.spec.ts`
- `tests/e2e/popup.real-nas.spec.ts`
- `src/api/client.ts`
- `src/lib/tasks.ts`
- `src/api/schema.d.ts`

## 10. What the tests already cover today

The tests currently verify:
- login and SID reuse
- query body serialization (`limit`, `field`, etc.)
- multipart upload (`sid`, `temp`, `move`, `dest_path`, `bt`, `bt_task`)
- duplicate torrent handling (`24593`)
- a dedicated mock-only contract test for `mockNas`
- popup full cycle against the mock NAS
- real NAS read-only smoke
- real NAS mutating flow, limited to a suite-owned torrent
- `mockNas` contract against a more real-like QNAP payload

## 11. Recommended check order in a PR

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

Real NAS runs stay local-only, run only when needed.
