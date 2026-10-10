---
type: research
status: active
area: testing/interface
updated: 2026-10-09
---

# Popup feedback audit and normalization plan

## Initial investigation decision

At the investigation baseline, the tests were useful but insufficient to approve broad notification optimization.
The next change should add focused regressions and fix popup ownership/recovery before deduplication.
The user clarified that the observed inappropriate or persistent messages are **inside the extension popup**.
The initial investigation changed documentation and task state only. The later acceptance section records the implemented bounded corrections.

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
index modules and 27 non-gallery/non-showcase Svelte source files are outside that metric.
The Svelte count includes the preserved unused `Card.svelte`; it is not a count of 27 live,
untested features.
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

## Findings verified against the investigation baseline

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
unchanged. The initial diagnostic tested Pause only; individual Start/Stop/Pause probes are recorded
in the revalidation section below.
The current happy-path E2E and manager fallback unit test do not protect this boundary.

### P3: transient and persistent messages have inconsistent policy

[Settings save without connection test](../../src/popup/features/settings/Settings.svelte) (line 463)
shows success without `autoHideMs`; connection success uses 2500 ms; upload/control confirmations
use 1500–3000 ms. Error status generally remains until overwritten, including resolved poll errors.
Persistence is directly established in code and with a 60-second fake-timer probe. An intentional
sticky actionable error should retain its action/context; an obsolete error should resolve when
its own operation recovers. A default timer alone cannot make that distinction.

### Fault-injection finding: post-acceptance upload callbacks share the request catch

Owner: [ENG-17](../../tasks/ENG-17.md). Mimic identified this in the recheck; three temporary
unit probes verified full torrent acceptance, torrent duplicate, and partial URL-batch outcomes.
In each, the API result was mocked and the supplied success/duplicate callback deliberately threw.
The real popup status renderer then replaced the accepted/duplicate/partial result with
`Error: post-acceptance callback failed` and cancelled its success/info expiry timer.

The current built-in callbacks were not observed throwing. This is a demonstrated boundary under
fault injection, not evidence of a frequent live defect or a proven cause of the user's symptom.
The plan must distinguish accepted work from a later UI/refresh failure, preserving any genuinely
useful callback error separately. Do not report that the NAS rejected already accepted work.

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
| Upload/full/partial/duplicate outcome | Inject throwing success/duplicate callbacks; accepted/partial/duplicate work stays identified, later UI failure is classified separately | Actual status visible and correct after subsequent refresh |
| Popup close/reopen and settings change mid-request | Abort/superseded result cannot report as a new failure or overwrite current state | No stale error on reopened popup; no lost current action |

Use fake timers/deferred promises for unit ordering; E2E waits on requests/state, not arbitrary
sleeps. Add new spec files to the explicit `test:e2e:mock` command, and keep headed/default lists
consistent. Capture `pageerror` around these scenarios. Do not introduce a global console-error
ban that hides deliberately exercised worker network failures.

Go/no-go: each confirmed defect needs a regression that fails on the baseline and passes
with the corresponding fix. Tests of already-correct contracts should pass on both revisions;
they protect behavior rather than manufacture baseline failures. The current diagnostic probes assert the defect, so they must not
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
- Reject obsolete query results after abort or a NAS-settings revision; skipped queries do not
  establish recovery. Use deferred success and failure to prove a newer list/operation cannot
  be overwritten by an older result.
- Define precedence for concurrent explicit actions: an older action completion cannot overwrite
  the latest action outcome. Distinguish an accepted Remove from a subsequent failed refresh.
- Catch control failures at one existing user-operation boundary; preserve Pause fallback and
  successful-command semantics. Avoid catching the same failure in multiple layers and producing
  two announcements.

Protect accepted/partial/duplicate popup outcomes from post-acceptance callback failures in
ENG-17, while retaining separately scoped information about a failed UI refresh. Pause fallback
acceptance must cover both successful and failed Stop, and feedback must describe the actual
fallback outcome rather than assume Pause and Stop are equivalent.

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

## Revalidation after gateway repair: 2026-10-09

Rechecked on `5dbb6fe`; runtime source, Vitest configuration and package scripts are unchanged
from the initial baseline. Mimic status now reports an authenticated, available gateway without
loading the external token into this session.

| Recheck | Actual result |
| --- | --- |
| Full unit/fixture coverage run | 38 files / 513 passed; all four coverage measures unchanged |
| Full mock E2E | 45 passed |
| Strengthened Chromium diagnostics | 4 passed, describing current defects |
| Repeated and strengthened unit diagnostics | 5 passed, describing current defects |
| Timer-preservation probes | 2 passed, describing already-correct behavior |
| Callback fault-injection probes | 3 passed, describing accepted-result replacement |
| Types, Svelte, lint, production build | Passed; Svelte 0 errors / 0 warnings |
| Documentation self-tests, links/reviews, language, Rulesync | Passed; 11 self-tests |

The recovery diagnostic now waits for a successful response through **the popup page's own**
`waitForResponse`, checks `{error: 0}`, and observes a newly rendered `Recovery marker` task
that was absent during failure. The old status still remains visible. This removes the weaker
original inference from a NAS-wide request counter that could include worker polls.

Start, Stop and Pause were individually denied through popup request interception. Each matched
endpoint received exactly one command, each produced the corresponding `pageerror`, and none
replaced the prior status with meaningful failure feedback. BUG-72 is therefore independently
browser-reproduced for all three actions.

BUG-73 was rechecked without replacing the torrent sender/API client: the checked-in torrent
was fetched through MSW, the mock `AddTorrent` returned `{error: 0}` exactly once, then session
cleanup rejected. The code still reported `Download failed` and did not cancel the browser
transfer. This remains mocked acceptance, not a physical-NAS result.

Two preservation probes establish that `showStatus()` already cancels superseded timers: an old
success timer neither hides a later timed confirmation nor dismisses a newer persistent error.
Do not describe timer replacement as a reproduced defect or add a redundant second timer system.
The missing contract is async operation ownership and recovery, not basic timeout cancellation.

The three callback-fault probes confirmed Mimic's additional boundary concern after repairing
a temporary test mock that omitted the setup hook's `invalidateClientCache` export. That initial
fixture failure is excluded from product evidence; all three corrected probes passed. They use
mocked API outcomes and deliberate throwing callbacks, not an observed production callback fault.

The repository-wide snapshot search again found its writer/construction and declarations, but
no production reader/subscriber. No inference from repeated variable names or isolated Knip
exports is used to remove functionality.

The new Mimic review independently agreed with the source-level popup findings and challenged
the old recovery evidence, Pause-only coverage, universal red-baseline gate and timer-defect
framing. Those limitations were addressed in this recheck. Its new callback-boundary observation
was verified with fault-injection tests and added as ENG-17, scoped below confirmed user-path bugs.
Its selected packet is not a repository-wide audit; snapshot consumer absence comes from our
local reference search, not the model's inference.

The same-session follow-up incorporated the strengthened evidence and concluded: targeted
fixes can begin with permanent acceptance regressions; broad normalization and release sign-off
remain unsupported. Its final order is regression gates → poll ownership/stale requests →
user-action rejection handling → acceptance-boundary isolation → evidenced cleanup. Existing
timer cancellation and sticky toolbar acknowledgement remain intact.

Gateway qualification: one intermediate follow-up returned a Python attachment-inspection
snippet rather than a final assessment, despite a completed CLI status. That snippet was not
accepted as a review. A subsequent explicit final-answer request returned substantive prose.
Authorization is repaired, but this output-extraction edge case was still observed.

Remaining prerequisites are explicit: deterministic Save/Test/Upload versus poll interleaving;
stale success/rejection after request/settings invalidation; overlapping user actions; failed
Stop after unsupported Pause; accepted Remove followed by failed list refresh; normal callback
and close/reopen behavior. No test in this recheck certifies those unexecuted scenarios.
Repeated screen-reader announcements and OS notification persistence were not measured.
The acceptance gate is for focused fixes with these tests, not permission for broad refactoring.

Fresh local logs: `/tmp/quickget-recheck-coverage.log`, `/tmp/quickget-recheck-e2e.log`,
`/tmp/quickget-recheck-browser.log`, `/tmp/quickget-recheck-unit-probes.log`, and
`/tmp/quickget-recheck-timer-preservation.log`, and `/tmp/quickget-recheck-upload-callbacks.log`. Temporary probes are removed from active discovery;
the results above are investigation evidence, not new committed acceptance tests.

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

## Accepted implementation and review

Terra implemented the isolated patch and the root reviewer accepted the integrated candidate on
2026-10-09 after source review and independent project checks. 546 unit/fixture tests, 58 Chromium mock E2E, typecheck, Svelte (0 errors/warnings), lint, production and Storybook builds, and 28 deployment unit tests passed in the integrated env/dev working copy.

| Coverage measure | Integrated result | Scope |
| --- | --- | --- |
| Statements | 88.96% | Existing configured TypeScript subset |
| Branches | 83.22% | Executed branches, not every user scenario |
| Functions | 88.59% | Entrypoints and Svelte remain outside the metric |
| Lines | 89.57% | No exclusions added to inflate the result |

The initial regression batch recorded 14 failures before implementation. Root review then
reproduced late upload/callback overwrite, changed-error dismissal, orphaned Remove state and
misclassified transport failure after Pause fallback. Six review regressions were red before
those corrections; later stale-rejection/skipped-reconciliation and cross-writer guard probes
were also red. The final connection-reset regression failed before its one-line owner-scoped
reset and passed afterward. Baseline-passing timer cancellation was preserved.

Permanent evidence now includes downloads feature orchestration tests, accepted-feedback tests
using the real status DOM, status-pill fake timers and the default/headed feedback-normalization
browser spec. Browser cases cover popup-owned recovery, denied/retried commands, Stop fallback
success/API denial/transport rejection with exact counts, poll competition, pending upload,
plain-save expiry, keyboard dismissal, delayed A work after B replacement/removal and popup
close/reopen. Old command responses and query terminal events are awaited before final stale-work
assertions; the replacement NAS's two rows and badge remain authoritative.

Mimic's final source review identified an episode-dismissal state that survived connection change;
local review confirmed it and Terra added the scoped reset. Its stale-query catch and skipped-remove
remarks applied to the packet snapshot; both had already been corrected in the newer candidate.
Earlier suggestions to catch monitoring/badge helper throws were rejected after inspecting the
production bridge, which already catches synchronous and asynchronous messaging failures.
Mimic opinions did not substitute for executed tests or root acceptance.

The deleted snapshot, unused Card/test helpers and redundant direct dependencies were rechecked
for consumers. Selection, current list rendering, NAS duplicate handling, retained package
versions and live neighboring helpers remain. The canonical MV3 standard and review guide now
match NAS-first acceptance, ephemeral claims and actual local credential storage.

Accepted cards: BUG-58, BUG-72, BUG-73, ENG-15, ENG-16, ENG-17, ENG-18, ENG-9 and ENG-10.
BUG-71 remains partial for broader page/native/new-tab/retained-tab feedback policy. The focused
work does not certify physical NAS, private trackers, Firefox, operating-system notification
persistence or measured screen-reader announcements. No release or Store publication occurred.

Local acceptance logs use `/tmp/quickget-integrated-*.log`; regression review logs use
`/tmp/quickget-feedback-root-corrections-baseline-red.log`,
`/tmp/quickget-feedback-remove-stale-baseline-red.log`,
`/tmp/quickget-feedback-upload-race-baseline-red.log` and
`/tmp/quickget-feedback-connection-episode-baseline-red.log`. The scenario/results above are durable
evidence; temporary files are not required to understand the accepted contracts.


## Subsequent bounded polish: 2026-10-10

The earlier pending BUG-71/page/native/retained-tab statements above describe the 2026-10-09 acceptance boundary. The subsequent [final polish audit](../quality/code-quality-audit.md#final-integrated-acceptance) accepts the finite feedback matrix, real extension reload, native creation queue/rejection handling and gray attention acknowledgement. Current behavior belongs to [[feedback]] and [[page-capture]]; OS display and universal tracker/firmware proof remain external limits.
