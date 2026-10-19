---
type: task
id: BUG-80
status: done
priority: p3
severity: low
area: background/download interception
board: bugs
updated: 2026-10-19
---

# Successful torrent handoff leaves an invalid download ID error

## Outcome

A normal torrent click sends one torrent to Download Station, leaves no browser file or download
history item, and records no extension runtime error in Chromium.

## Problem

After NAS acceptance the extension cancels and erases the browser download, then invokes its
held filename suggestion callback. Chromium reports `Unchecked runtime.lastError: Invalid downloadId`
with an empty context and an anonymous frame at line zero. The error occurs after the accepted
handoff; the reproduced scenario does not lose or block the torrent.

## Acceptance criteria

- [x] Reproduce the exact browser error without manual cancellation.
- [x] Establish a failing regression using native Chromium downloads and its extension error log.
- [x] Correct callback lifetime without weakening the regression or hiding browser errors.
- [x] Preserve one NAS handoff, no local file on success, and browser fallback on earlier failure.
- [x] Independently review the fix and pass the project checks.

## Evidence

2026-10-19: production build 2.6.1 in Chromium 149.0.7827.55 with the existing local mock NAS
reproduced the exact error in three consecutive isolated-profile runs. Each sent one AddTorrent
request and left no local file or browser history entry. A separately instrumented copy traced
successful cancel, successful erase, then the held suggestion callback. No real NAS task was created.

The existing ordinary-click test in `tests/e2e/download-interception.spec.ts` now enables error
collection through the browser's own `chrome://extensions` API and asserts an empty runtime error
log after the successful handoff. Its first run failed on the exact reported error, after the
successful-send and no-local-file assertions passed. Ordinary Playwright console events alone
miss this internal callback error. Local diagnostic artifacts are under the ignored
`.e2e-artifacts/invalid-download-id/` directory; they are not production instrumentation.


## Accepted correction: 2026-10-19

A bounded Codex worker (`gpt-6-luna`) changed the runtime to discard the held filename callback
immediately after successful browser cancellation and before erasing history. Parent Codex
retained ownership of the browser regression, reviewed the runtime diff, and accepted the result.
The callback remains available to `finally` when cancellation fails; an erase failure after a
successful cancellation does not invoke the invalid callback. No runtime error suppression,
persistent state, or early release of the browser save decision was added.

Validation:

- Red: `npx playwright test tests/e2e/download-interception.spec.ts --grep 'ordinary torrent click sends' --workers=1`
  failed on `Unchecked runtime.lastError: Invalid downloadId` before the fix.
- Green: the same unchanged browser regression with `--repeat-each=3 --workers=1` passed three times.
- Targeted handoff unit tests passed 40/40, including cancellation rejection and erase rejection.
- `npm run typecheck`, `npm run check:svelte` (zero errors/warnings), `npm run lint`,
  `npm test` (597 tests), and `npm run build` passed.
- `npm run test:e2e:mock` passed all 61 Chromium scenarios.
- The original diagnostic probe against the corrected production bundle recorded one AddTorrent
  request, no local files, no browser download entries, and an empty extension runtime error log.
- `npm run test:docs` passed 11 tests; documentation review/check and English prose checks passed.

Both browser runs use a local mock NAS; no fresh physical-NAS claim or release is made.
Severity remains low (`p3`): the reported and reproduced error followed confirmed NAS acceptance
and did not block that handoff. This assessment does not classify unrelated download failures.


## Release verification: 2026-10-19

**Resolved 2026-10-19** — shipped in v2.6.2: successful browser torrent handoffs discard their
cancelled filename callback instead of reporting `Invalid downloadId`.

Fresh checks on version 2.6.2 passed: 597 unit/fixture tests, 61 Chromium mock E2E, 28 deployment
tests, 11 documentation tests, five quality-audit tests, typecheck, Svelte, lint, contrast,
production/dev/Storybook builds, Firefox build/lint/package, and documentation/language checks.
The local production spot check passed all six scenarios against the real NAS, and the owned-task
ledger was empty afterward. This hardware gate verifies NAS contracts; native Chromium interception
and its error log remain covered by the mock-NAS browser regression.
