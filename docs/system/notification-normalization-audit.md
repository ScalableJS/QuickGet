---
type: research
status: active
area: testing/interface
updated: 2026-10-09
---

# Popup feedback audit and normalization plan

## Decision

The current test baseline is useful but insufficient to approve broad notification optimization.
The next change should add focused regressions and fix popup ownership/recovery before deduplication.
The user clarified that the observed inappropriate or persistent messages are **inside the extension popup**.
This audit changes documentation and task state only; runtime behavior remains unchanged.

Baseline: `e1750e4`, 2026-10-09. [[feedback]] describes current surfaces; this page records the
investigation and proposed changes. [[verification]] owns the verification-layer definitions.

## Fresh measurements and limits

| Check | Executed outcome | Boundary |
| --- | --- | --- |
| `npm run test:coverage` | 38 files, 513 tests passed | Includes unit and fixture tests; Chrome APIs mocked |
| V8 statements | 88.61% (1565/1766) | Configured TypeScript subset |
| V8 branches | 82.51% (1114/1350) | Executed branches, not scenario completeness |
| V8 functions | 88.62% (304/343) | Same configured subset |
| V8 lines | 89.26% (1406/1575) | Same configured subset |
| `npm run test:e2e:mock` | 45 passed | Chromium, development build, local mock NAS |
| Additional diagnostic unit probes | 5 passed | Assertions deliberately describe existing undesirable behavior |
| Additional diagnostic browser probes | 2 passed | Real Chromium popup with controlled HTTP failure/recovery |
| Types, Svelte, lint, production build | Passed; Svelte 0 errors / 0 warnings | Static/build validation, not runtime recovery |
| Documentation self-tests, registry/links, language, Rulesync | Passed; 11 self-tests | Documentation integrity, not notification correctness |
| Knip | Report contains findings; exit 1 | Static candidates, not an algorithm clone detector |

`vitest.config.ts` includes TypeScript paths but excludes all `src/**/index.ts` files. Twelve
index modules and 27 non-gallery/non-showcase Svelte components are outside that metric.
Exclusion from the metric does **not** mean no test exercises them: for example API authentication
has its own unit suite. Conversely, `settingsUI.test.ts` tests panel visibility, not the
Settings component's save/test lifecycle. There are no configured numerical coverage thresholds.

Notable measured areas: `notifier.ts` has 100% branch coverage, yet concurrent duplicate
notifications reproduced; `statusPill.ts` has 90.47% branches, yet its callers' recovery contract
is missing; `downloadsManager.ts` has 44.44% functions; `autoRefresh.ts` and `downloadsUI.ts`
have 0% unit execution coverage. These numbers are triage signals, not evidence to refactor all
low-coverage code. Existing E2E protects happy-path task controls, interception, routing, connection
budgets, themes and accessibility. It does not assert poll-error recovery, feedback precedence,
rejected toolbar actions, or page-toast expiry. `console-clean.spec.ts` is not in the default
mock-suite command and concerns initial console output, not action rejection.

No fresh physical-NAS, private-tracker, Firefox runtime, or operating-system notification run
was performed. E2E counts are not an E2E coverage percentage.

## Findings verified against current code

### P2: poll errors remain after recovery and compete with user actions

Owner: [BUG-58](../../tasks/BUG-58.md).

- [Downloads initializer](../../src/popup/features/downloads/index.ts) (line 37) writes every failed
  refresh to the shared status pill; successful refresh updates the list and badge snapshot
  without resolving that error.
- [Auto refresh](../../src/popup/features/downloads/autoRefresh.ts) (line 19) calls it every two seconds,
  including while Settings is visible. Settings, uploads, task controls and startup attention
  all write the same message element.
- [Status renderer](../../src/popup/components/statusPill/statusPill.ts) (line 22) defaults to no expiry;
  [popup markup](../../src/popup/index.html) (line 18) provides no dismissal control.
- Chromium diagnostic: abort popup `Task/Query`, wait for `Failed to list downloads`, restore
  the route, observe a new accepted query and visible list; the old error remains in a visible
  status bar. This is a reproduced recovery defect, not a guess from the coverage score.

A blanket `clearStatus()` on every successful poll is unsafe: it can delete an unrelated
upload/save/action message. Resolution must identify the owner of the message it is resolving.

### P2: toolbar start/stop/pause rejection has no visible failure outcome

Owner: [BUG-72](../../tasks/BUG-72.md).

[Task control wrappers](../../src/popup/features/downloads/index.ts) (line 88) await the API then show
success, with no failure handling. [Toolbar dispatch](../../src/popup/features/toolbar/index.ts) (line 32)
uses `void downloads.start/stop/pause` without a catch. Remove and priority actions have different
error handling, so equivalent user actions have different terminal contracts.

Chromium diagnostic: select a real rendered task, answer `Task/Pause` with `{error: 6}`, then click
Pause. Playwright receives `pageerror` containing `Pause task failed`; the status message remains
unchanged. Start/Stop share the same uncaught structure but were not individually browser-probed.
The current happy-path E2E and manager fallback unit test do not protect this boundary.

### P3: transient and persistent messages have inconsistent policy

[Settings save without connection test](../../src/popup/features/settings/Settings.svelte) (line 463)
shows success without `autoHideMs`; connection success uses 2500 ms; upload/control confirmations
use 1500–3000 ms. Error status generally remains until overwritten, including resolved poll errors.
Persistence is directly established in code and with a 60-second fake-timer probe. An intentional
sticky actionable error should retain its action/context; an obsolete error should resolve when
its own operation recovers. A default timer alone cannot make that distinction.

## Duplication and state review

Scope: extension API, background event/notification paths, content dispatch, popup polling,
actions, uploads, settings state, task presentation and shared helpers. Findings use direct
call-site checks as well as Knip; this is not a claim of exhaustive semantic clone detection.
Repeated variable names in independent contexts are not defects by themselves.

| Candidate | Evidence | Disposition |
| --- | --- | --- |
| Unread duplicate-detection snapshot | `downloadsManager.ts:24` builds raw-task hash/name sets on every query; `downloadsState.ts:41` readers/subscribers have no production callers | Remove the snapshot pipeline in [ENG-16](../../tasks/ENG-16.md) after preserving selection/list/real NAS duplicate handling |
| Repeated thrown-value conversion | `batchUpload.ts:57`, `torrentUpload.ts:51`, `ApiClient.addUrls/setTaskFiles`; same `Error.message` vs `String` expression already exists in `lib/errors.ts` | Reuse existing helper locally, preserve deliberate fallback wording; do not combine API response-envelope parsing with thrown-value extraction |
| Magnet/link content dispatch | `magnet.ts:279` and `:326` repeat in-flight guards, loading, callback error handling, terminal feedback, fallback | Test both protocols first; consider one narrow internal dispatch function only if it reduces code and preserves separate payload/navigation contracts |
| Failure classifiers | `downloads.ts:262`, `:272`, `connectionHealth.ts:95` each classify authentication/network failures differently | Shared policy vocabulary is needed; preflight NAS login and tracker access are distinct. Preserve typed login codes and boundary-specific consequences |
| QNAP error dictionaries | `api/utils.ts:55` and `downloadItem/format.ts:66` overlap codes with different wording and incomplete sets | Review semantic codes with fixture evidence; task-reported error codes and immediate API errors may have different namespaces. Do not merge tables solely by matching integers |
| Client caches | `alarms.ts:29`, `popup/shared/api/clientCache.ts:14` have the same signature/rebuild shape | Independent execution contexts/lifetimes; retain local caches and shared `clientSignature()` |
| Folder transformations | `folderPath.ts:13` normalizes API input; `downloadItem/format.ts:251` compares display paths | Different contracts (including `share/` and backslash behavior); do not substitute one blindly |
| Task status/count/format helpers | Shared `lib/tasks.ts`, `formatRate`, routing/source helpers already exist | Preserve current shared algorithms; do not introduce another status/routing layer |
| Selection model and Svelte view | `selectedHash` bridged to `downloadsView.selectedHash` | Intentional presentation bridge; only one owner should mutate selection. No demonstrated stale-state bug in this audit |
| Existing unused UI/tooling | [ENG-9](../../tasks/ENG-9.md), [ENG-10](../../tasks/ENG-10.md) | Existing bounded cleanup tasks; no duplicate tasks created |

Knip flags unused exports, not necessarily dead implementations: status sets, exported formatters,
and helper functions may still be called internally. `@types/chrome` supplies ambient types;
its report is not permission to delete it. Global `tsx`/`ffmpeg` tools require separate toolchain
review. No dependency installation or functional removal occurred during this audit.

## Secondary findings outside the reported popup problem

### P2: feedback bookkeeping can change an already accepted handoff

Owner: [BUG-73](../../tasks/BUG-73.md). Mimic identified this boundary; a fifth diagnostic
unit probe reproduced it with mocked NAS acceptance: `sendTorrentUrlToNas()` resolves, then
`chrome.storage.session.remove()` rejects during `clearFailureEpisode()`. The catch in
`downloads.ts:210` reports `Download failed` and returns `false`, so the browser download is not
cancelled despite acceptance. This is a misleading failure and possible duplicate local outcome,
not demonstrated data loss. No actual NAS was contacted by this probe.

Keep NAS acceptance separate from best-effort feedback/monitoring bookkeeping. Add a regression
at this boundary before changing notification internals; do not catch or suppress the actual
pre-acceptance transport failure.


- `notifier.ts:43` reads then writes episode state without serialization. Two concurrent
  `notifyFailure()` calls with identical kind/fingerprint create two notifications in a unit probe.
  A single-worker queue is a candidate; storage remains authoritative across worker wakes.
- `clearFailureEpisode()` removes storage only, not an existing browser notification. Native
  notifications are created without an explicit stable ID and not cleared on recovery. That is
  code behavior; whether the OS displays a stuck banner was not tested. Persistence alone is
  not automatically a defect: decide actionable notification dismissal first.
- Content feedback has one host/timer and no operation identity. Unit renderer sequence:
  A loading, B loading, A success, advance 2500 ms → host removed while B could still be pending.
  This establishes missing correlation, not a real-world popup cause. Browser overlap and
  retained-tab/reinjection tests remain pending under [BUG-71](../../tasks/BUG-71.md).
- `chrome.notifications.create()` is not awaited; a synchronous catch does not handle an API
  promise rejection. Failure episode state is written before delivery is confirmed. Delivery
  failure and permissions/OS behavior need their own test and policy.

## Proposed normalization sequence

### 1. Establish regression acceptance before optimization

[ENG-15](../../tasks/ENG-15.md) owns the missing behavior matrix. Add tests for real contracts:

| Scenario | Unit responsibility | Browser E2E responsibility |
| --- | --- | --- |
| Poll failure → healthy query | Resolve only polling-owned health/error; do not clear unrelated messages | Old error disappears, list remains usable, no reload required |
| Poll failure while Save/Test/Upload runs | Direct operation outcome remains observable; repeated identical poll error does not reannounce every two seconds | User sees the relevant terminal outcome in each visible panel |
| Start/Stop/Pause/Remove denied, offline or unsupported | One terminal failure; supported Pause→Stop fallback retained; no false success | No unhandled page error; meaningful visible error; subsequent retry works |
| Status timeout/replacement/dismiss | An old timer cannot erase a newer message; persistent message can be dismissed or resolved | Success expires; actionable error remains only while relevant; keyboard access if dismiss exists |
| Upload/full/partial/duplicate outcome | Monitoring and refresh callbacks cannot overwrite accepted outcome | Actual status visible and correct after subsequent refresh |
| Popup close/reopen and settings change mid-request | Abort/superseded result cannot report as a new failure or overwrite current state | No stale error on reopened popup; no lost current action |

Use fake timers/deferred promises for unit ordering; E2E waits on requests/state, not arbitrary
sleeps. Add new spec files to the explicit `test:e2e:mock` command, and keep headed/default lists
consistent. Capture `pageerror` around these scenarios. Do not introduce a global console-error
ban that hides deliberately exercised worker network failures.

Go/no-go: critical cases must have a demonstrated failing regression on the baseline and pass
with the corresponding fix. The current diagnostic probes assert the defect, so they must not
be installed unchanged as passing acceptance tests. No blanket percentage threshold replaces
this gate. A numerical ratchet can follow once entrypoint/component coverage is measured honestly.

### 2. Normalize popup ownership and recovery

Fix BUG-58 and BUG-72 in bounded changes, paired with the regressions above.

- Keep periodic task health in the downloads area or one scoped health state; reserve operation
  announcements for explicit user actions. Health/error state and transient confirmation are
  different lifecycles.
- Use the existing status mechanism with the smallest needed owner/revision guard if required;
  no global event bus, universal notification service, or component migration.
- Resolve only the recovered owner. Make transient duration consistent by intent, not caller.
  Persistent actionable errors need a clear recovery/dismiss contract.
- Catch control failures at one existing user-operation boundary; preserve Pause fallback and
  successful-command semantics. Avoid catching the same failure in multiple layers and producing
  two announcements.

Handle BUG-73 as a separate narrow transaction-safety fix with a rejection-injection regression;
accepted NAS results must survive feedback bookkeeping failures.

Exit gate: repeated poll failures do not overwrite Save/Test/Upload; successful refresh resolves
its own obsolete warning; every toolbar action has one observable terminal outcome; all existing
unit/mock E2E plus new regressions pass. Local types/Svelte/lint/build remain green.

### 3. Remove evidenced duplication without changing policy

Delete ENG-16's unread snapshot branch, reuse the existing thrown-error helper where semantics
match, and complete ENG-9/ENG-10 separately with their own checks. Consider content dispatch and
error-dictionary extraction only after dedicated tests establish equivalence. Preserve caches,
API/body contracts, shared source classification, routing and independent presentation state.

Exit gate: task selection, list queries, upload duplicates and interceptions are unchanged;
no new dependency or speculative abstraction; modified code is smaller or has fewer independent
policy owners. Review the affected [[documentation|feature documentation]] individually.

### 4. Extend verification to secondary surfaces and release

Investigate native failure serialization/delivery and content-operation correlation separately.
Keep automatic success silent per existing policy; a normalization must not restore notification
spam. Run focused native/retained-tab checks if those surfaces change. A production release still
requires the real-NAS spot check; Firefox requires distinct runtime evidence.

## Consultation and evidence retention

Mimic was explicitly requested for a second opinion. Source packets contain selected code,
configuration and measurements, not credentials. The gateway token is loaded from the existing
external `~/.config/ai-secrets/agy.env` (`MIMICGATE_TOKEN`); its value is not recorded here.
Two independent Mimic consultations were completed: a broad notification/state review and a
focused popup review using the user's clarification and the browser probes. Mimic did not run
the tests independently. Accepted recommendations: behavior-level regression gates, poll-owned
health separate from action feedback, one toolbar rejection boundary, localized changes,
repository-wide snapshot checks, and keeping secondary surfaces separate. Its accepted-handoff
bookkeeping finding was verified with the fifth unit probe.

Qualification of the broad opinion: it called persistent `!` a defect and proposed clearing it
on every recovered poll. Current `actions.ts` intentionally preserves actionable attention until
popup acknowledgement; this is a policy question, not a confirmed regression. The proposed
normalization retains it unless a separate policy decision changes it. Claims about overlapping
alarm polls, gray-notice acknowledgement, missing messaging completion, and OS banner persistence
remain follow-up hypotheses or established code behaviors, not newly reproduced user defects.
No vendor behavior is accepted from the consultation's external citations. The local source,
actual tests and the user's popup scope determine this plan.

Mimic proposed P1 for the two popup findings; this project records them as P2/medium because the
reproduced impact is misleading or absent feedback, with no demonstrated data loss or universal
app failure. The substantive test-first priority is retained.

The diagnostic probes were temporary, removed from active test discovery, and did not modify
production sources. Fresh outputs live in `/tmp/quickget-audit-coverage.log`,
`/tmp/quickget-audit-e2e.log`, `/tmp/quickget-audit-probes.log`, and
`/tmp/quickget-audit-browser-probe.log`, and `/tmp/quickget-audit-bookkeeping.log`. These are local investigation artifacts, not durable
runtime certification; this page retains the measured result and reproducible scenario.
