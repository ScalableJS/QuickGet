---
type: task
id: BUG-81
status: done
priority: p2
severity: medium
area: settings/form interaction
board: settings-ux
updated: 2026-10-19
---

# Make settings submission, imported drafts and missing fields explicit

## Outcome

Enter in a settings text/password field uses the same save path as the Save button. A failed
submission identifies and focuses its missing or malformed field. Import visibly restores the
connection draft and makes the remaining Save step clear.

## Problem and reproduced cause

The settings component had no form submit handler, so Enter in the password field did nothing.
Saving parsed the server URL before marking missing fields, so an empty address bypassed the
field errors. Shared Field styles could also compete with the focused input border.

The reported loss of NAS address, username and folders was not reproduced in serialization.
The user-provided backup contains all these values; a full export/import/Save/reopen browser
round-trip passed on the unchanged implementation. Import confirmation changed only the draft,
remained on Advanced, and displayed a brief confirmation. Enter after filling the excluded NAS
password then failed to save. This explains how a complete backup could appear not to persist;
it does not prove which exact gesture sequence occurred in the original report.

## Acceptance

- [x] Establish red browser regressions for Enter submission and missing-address field errors.
- [x] Verify the actual backup locally without copying its contents into repository artifacts.
- [x] Preserve portable backup fields and exclude passwords.
- [x] Use native form submission and preserve folder-picker Enter behavior.
- [x] Show required-field errors on submit, clear them on editing, and retain red borders in focus.
- [x] Reveal imported connection values and clearly describe the separate Save step.
- [x] Complete source review and the project checks.

## Scope and consultation

Mimic (GPT-6 Extra High) reviewed the existing sources and proposed a bounded form/validation fix.
Its recommendation to rewrite export as saved-only was not adopted: current-draft export is the
existing behavior, and the actual backup and unchanged round-trip show no missing portable values.
No backup format, password storage, NAS API or background authentication policy was changed.

The parent owns settings/runtime integration and tests. A separate bounded worker created
[DEMO-7](DEMO-7.md) for media refresh after the settings experience settles.

## Authentication research: 2026-10-19

The QNAP manual describes NAS-user application privileges for Download Station:
https://docs.qnap.com/operating-system/qts/4.2.x/cat2/en-us/download_station.htm

The NAS-served `/downloadstation/libs/ds-all.js` was fetched read-only. Its login view marks the
username nonblank, permits submitting a blank password, and reports the server authentication
result. Its initial session attempt can reuse an existing QTS session. These are evidence of
vendor client behavior, not proof that anonymous access or an empty password can create tasks on
the appliance. No failed login attempts, account changes or new authentication modes were used.
The extension's current explicit-credential requirement remains unchanged pending such evidence.

## Evidence

- `tests/e2e/settings-connection.spec.ts`: red Enter and missing-address checks; full backup
  round-trip; imported draft and folder-picker keyboard boundaries.
- `tests/e2e/a11y.spec.ts`: confirmation, focus, invalid-field and keyboard accessibility checks.
- Local ignored `.e2e-artifacts/settings-review/` contains red/green logs, consultation and bounded
  vendor excerpts. No user backup contents or real credentials were sent to Mimic.


## Acceptance: 2026-10-19

Parent source review accepted the bounded changes after Mimic's initial static consultation and
red/green browser evidence. A requested follow-up patch review failed twice at the gateway's
attachment check before sending; no patch-review response or approval is claimed from those calls.

`npm run typecheck`, `npm run check:svelte` (zero errors/warnings), `npm run lint`, `npm test`
(597 tests), and `npm run build` passed. `npm run test:e2e:mock` passed all 64 scenarios, including
15 focused settings/accessibility scenarios. Documentation tests/check and English guard passed.

The user's actual backup was also imported into an isolated browser profile: endpoint, username,
temp and target folders matched the file, and Enter correctly focused the excluded missing NAS
password. Values were compared without logging them. No real login attempt was made with that
backup, and no hardware authentication-mode support is inferred. There is no new production
release in this change.


## Import simplification: 2026-10-19

The user explicitly removed the intermediate replacement confirmation. Choosing a valid backup
now fills the draft immediately and reveals imported connection values. Save or Enter remains the
only persistence action. Invalid JSON leaves the existing draft untouched. The pending-import
state, confirmation markup, and its unused change-description helper/tests were removed.
The browser regression checks direct application, unchanged storage before Save, invalid-file
preservation, and reopening without Save; the round-trip regression saves the imported draft with
Enter. This supersedes the earlier confirmation behavior recorded above.


Fresh simplification checks passed: 594 unit/fixture tests (three tests of the removed confirmation
helper were deleted with it), 64 Chromium mock E2E, 11 documentation tests, typecheck, Svelte,
lint, production build and documentation/language checks. The direct-import browser assertion
failed against the previous confirmation flow before passing against the simplified implementation.


## Release verification: 2026-10-19

**Resolved 2026-10-19** — shipped in v2.6.3: Enter saves settings, missing/malformed fields are
identified at submission, and valid backup selection fills the form without a Replace step.

Fresh final gates on version 2.6.3 passed 594 unit/fixture tests, 64 Chromium mock E2E, 28 deployment
tests, 11 documentation tests, five quality-audit tests, types/Svelte/lint, contrast,
production/dev/Storybook builds, Firefox build/lint/package, and documentation/language checks.
The production spot check passed all six scenarios against the real NAS, with zero outstanding
owned runs in its cleanup ledger. This supersedes the earlier local-only acceptance status.
[DEMO-7](DEMO-7.md) remains an open media refresh task rather than a claim that media was regenerated.
