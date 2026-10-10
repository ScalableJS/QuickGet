---
type: research
status: active
area: engineering
updated: 2026-10-10
---

# Code quality and algorithm duplication audit

The baseline audit covers env/dev runtime at eee8364 and was committed as d736270. Its initial inventory and findings are preserved below; the subsequent accepted-normalization section records runtime changes separately. Tests may use pragmatic any for concise mocks and fixtures. Production contracts remain subject to the no-any and minimal-assertion standard.

## Baseline inventory and limits

[The callable registry](functions.md) marks every inventoried implementation with scope, source location, automated screening and manual review state. [The machine report](functions.json) records source hashes, body fingerprints, candidate groups and risk locations. [Manual decisions](reviews.json) are tied to source hashes; editing a reviewed source invalidates its manual assessment until reviewed again.

| Scope | Implementations |
|---|---:|
| Runtime TypeScript and Svelte | 566 |
| Tooling | 153 |
| Tests | 1694 |
| Browser/development harness | 43 |
| Total across 215 files | 2456 |

Implementations include nested callbacks, methods, Svelte template callbacks/snippets and inline HTML scripts; declarations and type-only signatures are excluded. 51 runtime functions have source-grounded manual family assessments. The remaining functions have automated screening, not a completed semantic review.

Whole-body fingerprints with at least 40 tokens yield 20 candidate groups, including two runtime start/stop families. Renaming and literal normalization can join different behavior. Partial repeated blocks, differently structured algorithms and distributed lifecycle logic can escape this method. Therefore a negative match is never a claim of no duplication. Review function ownership and observable contracts before extracting helpers.

## Baseline type quality

Runtime contains zero explicit any, double assertions, non-null assertions or ts-ignore/nocheck suppressions. It contains 45 ordinary type assertions, seven const assertions and one deliberate logger lint exemption. Assertions at DOM, generated API DTO and typed-array boundaries need contract review rather than blanket deletion. Compiler inspection finds 11 library-inferred-any bindings in runtime TypeScript: rejection reasons, Array.isArray elements, a regex replacement callback and Reflect.get. This is a review queue, not 11 proved unsafe operations. The inferred-type inspection does not inspect Svelte compiler output.

Tests contain four explicit-any uses and 19 double assertions for mocks/fixtures. These are permitted simplifications, not removal tasks. The code standard now explicitly distinguishes production and test policy. Existing lint excludes Svelte and relaxes test any; lint alone does not certify the production policy. The AST inventory also scans Svelte scripts.

Two actual contract defects need [ENG-19](../../tasks/ENG-19.md): isSuccessResponse accepts a string-zero error but claims a numeric BaseResponse, and createApiError declares plain Error while constructing code/reason/flag properties that consumers recover through casts. A local probe confirmed the string-zero predicate behavior. Preserve supported NAS representations while making types honest.

## Prioritized normalization

The [Code quality board](../../views/tasks.base) derives status from task frontmatter and sorts audit_order independently of priority.

| Order | Task | Finding and next gate |
|---|---|---|
| 1 | [BUG-74](../../tasks/BUG-74.md), p1 | Malformed HTTP 200 becomes successful AddTorrent acceptance; prove browser fallback before correcting acceptance |
| 2 | [BUG-75](../../tasks/BUG-75.md), p2 | Dynamic page-feedback text becomes HTML; use text-only insertion and preserve controls |
| 3 | [BUG-76](../../tasks/BUG-76.md), p2 | Empty pre-query snapshot and connection-unscoped worker results; controlled concurrency evidence first |
| 4 | [ENG-19](../../tasks/ENG-19.md), p2 | Honest error/success types and review inferred-any boundaries |
| 5 | [ENG-20](../../tasks/ENG-20.md), p2 | Share the page dispatch lifecycle kernel while preserving magnet/link payload and fallback differences |
| 6 | [ENG-21](../../tasks/ENG-21.md), p3 | Consolidate duplicated binary-size formatting after preserving edge cases |
| 7 | [ENG-22](../../tasks/ENG-22.md), p3 | Evaluate small typed NAS command transport; preserve unsupported pause and remove options |
| 8 | [ENG-23](../../tasks/ENG-23.md), discussion | Compare error-code facts and presentation/classification policy before consolidation |

## Confirmed repetition and distinct contracts

| Family | Review outcome |
|---|---|
| sendMagnetToWorker / sendLinkToWorker | Repeated in-flight claim, loading, callback release, lastError handling and terminal/fallback lifecycle; payloads and copy differ |
| scaleUnit / TorrentFiles.formatSize | Repeated 1024 unit selection and precision; finite/non-positive guards differ |
| API start/stop task methods | Repeated request serialization and success/error handling; pause/remove have additional semantics |
| Popup start/stop handlers | Small local wrappers are intentional repetition; a generic UI abstraction is not justified |
| Native notification / popup status / page toast | Separate browser contexts, persistence and lifetime; share policy facts where useful, retain separate rendering |
| API and task-card error catalogs | Nine overlapping codes, different wording and one card-only code; a mapping review precedes extraction |
| Popup/worker client caches | Shared clientSignature already exists; separate browser lifetimes require separate state |
| Request URL builder / editable server form | Validation/throwing vs editable empty state are distinct contracts |
| API coercion / task parsing | Defaulted API values vs absent task fields differ; do not merge by similar names |
| Base64 helpers | Tiny similar loops with different data/output boundaries and a self-contained injected function; no extraction task yet |
| Popup rate totals / badge summary | Shared addition idea, different idle/activity decisions; no complete merger justified |

[BUG-71](../../tasks/BUG-71.md) remains the wider feedback-intent/path matrix. Three notification surfaces do not prove three redundant notification algorithms. The completed popup ownership corrections remain accepted; broader monitoring and page rendering findings are separate follow-ups.

## Consultation and reproduced evidence

Mimic received runtime sources, then a focused bundle covering page feedback, native notification, popup status, API methods and task formatting. An initial one-line extraction was not accepted as a review; the completed focused response supplied a substantive second opinion. Model suggestions were checked against actual code rather than treated as test evidence.

Three temporary Vitest/MSW/jsdom probes passed observation assertions: an HTML HTTP 200 AddTorrent response resolved added:true; string-zero passed the success predicate; a markup message produced a B element in the feedback shadow root. The temporary probes were removed after recording outcomes. They reproduce present defects, not passing regression tests for corrections. No real NAS was contacted. HTML interpretation was demonstrated; script execution was not. Worker cancellation for malformed acceptance and the monitoring race still require dedicated regressions.

## Maintenance

Run npm run quality:audit for a read-only scan, npm run test:quality for scanner regression tests, npm run quality:report to explicitly regenerate both reports, and npm run quality:check to detect report drift. Manual assessments require updating the relevant source hash and explaining the decision in reviews.json; never reset all assessments to inflate coverage. Source hashes, rather than the informational sourceRevision, identify current content. The reports are research evidence, not an additional product-feature denominator.

## Verification of this audit change

Fresh local checks passed: typecheck, Svelte (zero errors/warnings), lint, 546 unit/fixture tests across 40 files, production build, five scanner self-tests, 11 documentation self-tests, callable report drift check, documentation integrity, English-prose guard and Rulesync generation check. This pass changes instructions, tooling, documentation and task metadata only. The preceding runtime acceptance recorded 58 mock Chromium E2E passes; that suite was not rerun for this audit. No fresh coverage measurement or physical-NAS result is claimed.


## Error-fact comparison for ENG-23

The API catalog records provenance from Download Station's ds-all.js / ENG.js in its source comment. This comparison uses that existing repository evidence, not a new appliance read. The task-card labels serve short row details; API errors describe request failure and retain meaningful reason text.

| Code | API fact | Task-card label | Decision |
|---|---|---|---|
| 4096 | Directory does not exist | Destination folder not found | Same broad fact; preserve request vs destination context |
| 4097 | Cannot access directory | Destination folder access denied | Same broad fact; local wording remains |
| 8196 | Task already exists | Torrent already added on NAS | API fact applies to tasks; row label narrows to torrent |
| 12288 | Download Station does not support URL | URL protocol not supported | Do not equate unsupported URL with protocol alone |
| 12289 | Could not download from URL | Download connection failed | Row wording is narrower than the API fact |
| 12290 | Could not resolve host | Host not found (DNS error) | Same broad fact; preserve presentation |
| 16384 | Incorrect magnet format | Invalid magnet link format | Same broad fact; local wording remains |
| 16385 | Torrent file not found | Torrent file not found | Exact wording alone does not justify a shared catalog |
| 16386 | Incorrect torrent format | Invalid or corrupt torrent file | Same broad fact; row wording adds interpretation |
| 20488 | Not present in the API catalog | Not enough disk space on NAS | Preserve the existing row mapping; independent vendor evidence remains missing |

Unknown task codes preserve customMessage before Error <code>; API failures preserve numeric code and non-URL reason details. Neither path should adopt the other's fallback. Native failure episode kinds additionally distinguish NAS preflight from tracker handoff; connection health uses LoginError identity and request context. Therefore a universal error-message dictionary or classifier is not accepted. ENG-23 remains discussion until the task-only code and narrower labels have authoritative evidence; no new vendor facts are inferred from this table.


## Accepted normalization: 2026-10-09

Codex orchestrated five bounded Terra CLI runs (gpt-5.6-terra/high), retaining root ownership of acceptance, documentation, registry refresh and Git. Shared-checkout write sets were disjoint during parallel implementation. BUG-74, BUG-75, BUG-76 and ENG-19 through ENG-22 are accepted; ENG-23 remains discussion with the comparison matrix and missing vendor evidence above. BUG-71 retains the wider page/native intent and correlation work.

Root rejected the first malformed-response fallback because HTML containing session-does-not-exist still passed duplicate inference. A red-before-green probe established the loophole, and the final code throws directly on unparseable NAS replies. Root also gated an old idle badge write, switched connection, and observed removal of the replacement alarm. The final teardown rechecks identity after the writer await. These two corrections supplemented Terra's initial six failing probes and later deferred query/failure probes.

Size formatting now has one binary owner; page sending has one local dispatch kernel; four typed NAS commands share only their request envelope. Public outcome wrappers and the three feedback renderers retain their distinct contracts. Error construction uses an accurate shape without a cast, success checking no longer promises DTO validation, and the 11 recorded inferred-any bindings use unknown or exact callback types. The first consolidation pass reduced runtime lines by 17. Final runtime edits total 204 added and 148 removed lines (net +56, excluding tests/prose); the additional ownership and alarm serialization guards account for the increase. The duplication refactors remain bounded rather than wholesale restructuring.

The refreshed inventory covers 2562 implementations in 215 files: 575 runtime, 153 tooling, 1791 tests and 43 harness. It records 63 manual family assessments with zero stale assessments. The removed TorrentFiles.formatSize entry is retired because that implementation no longer exists; its baseline evidence remains above and in Git history. The current scanner finds zero explicit or recorded library-inferred runtime any, zero runtime double assertions, and 42 ordinary runtime assertions plus seven const assertions. Four explicit test-any uses remain permitted. Inferred-type inspection remains TypeScript-only; Svelte has separate compiler diagnostics.

21 whole-body groups include two runtime start/stop wrapper pairs. These are marked as reviewed shared-transport/local-outcome or intentional popup repetition; the scan is not relabeled zero duplication. Unreviewed functions retain their visible automated-only state. No universal notification service, cache framework or error dictionary was added.

Fresh root integration passed: 571 unit/fixture tests across 40 files, 60 Chromium mock E2E, typecheck, Svelte (zero errors/warnings), lint and production build. Scanner/documentation/staged checks are recorded after registry review. Configured V8 coverage on the final patch: statements 90.86%, branches 84.96%, functions 89.77%, lines 91.56%. The include/exclude rules are unchanged: this measures selected TypeScript modules and excludes Svelte components and index entrypoints; it is not whole-product coverage. No physical NAS test, Firefox runtime result or store publication is inferred.


## Final consultation boundaries

Two gateway extractions returned an earlier audit or only a code fragment; neither was accepted as patch approval. A fresh prose-only request produced a substantive review. Codex selected structured session-expiry duplicate classification and concurrent request/writer/alarm ownership for reproduced corrective work. The conditional resetActionState concern has no production caller and was rejected as a runtime blocker. Pending dispatch, anchor download/target restoration and gray notice lifetime remain explicit BUG-71 policy/evidence work; no arbitrary deadline or universal notification framework is introduced. Model source anchors refer to its concatenated packet and are not repository line numbers.


### Corrective acceptance after the final Mimic review

The substantive final Mimic review prompted tests for structured authentication errors, same-connection out-of-order results, queued configuration/failure warnings and alarm rearming during removal. Terra restricted duplicate acceptance to the supported codes, introduced poll revisions, guarded the queued toolbar writer and serialized alarm removal with creation. Codex found two further defects during acceptance: ownership was checked before an awaited session-state read, and a rejected alarm clear turned a successful NAS reply into connection attention. Both new regression tests failed before correction and passed afterward. Ownership now follows the state read and awaited connection check; alarm bookkeeping failures are logged separately. The no-owner writer overload retains its definite result contract without a fallback or assertion.

These controlled cases establish their named interleavings, not universal concurrency certification. Ordinary page/native feedback lifetime and fallback policy remain BUG-71 work.


## Final polish execution: 2026-10-10

The independent Terra semantic pass read all 68 runtime files and inspected all 575 implementations in the starting registry, grouping nested handlers with their owning module contracts. This is a source/caller review, not a proof of universal correctness or zero duplication. Confirmed duplication decisions preserve separate storage/import, URL/form, numeric coercion, cache lifetime, rate/size, tracker/NAS and UI feedback contracts; whole-body matches remain candidates rather than an artificial zero score.

The pass found a missing multipart move parameter when the Target setting is empty. Codex accepted the omission finding and rejected the proposed new mandatory-setting policy: the minimal correction sends the already declared required parameter, leaving the NAS to validate its value. The request-body regression fails before the correction and passes afterward. No assumption that every firmware accepts an empty value is made.

Codex inspected the previously failed CI browser run 37991849420. Its trace shows the ordinary file reached browser download handling rather than AddUrl. A controlled settings regression established that default backfilling could overwrite a newer file-capture choice; a second controlled regression showed the same race for HTTPS, port and theme, so settings reads now resolve all defaults in memory and leave persistence to save/migration. This corrects a reproduced race without weakening the browser assertion or adding waits/retries.

### Vendor error fact verification

Public Download Station assets libs/ds-all.js and lang/ENG.js were fetched directly from the locally configured NAS on 2026-10-10, without logging its address or credentials. This supplies primary installed-vendor evidence for the nine shared codes and code 20488; it does not imply every firmware uses identical codes.

| Code | Vendor language key | Interpretation |
|---|---|---|
| 4096 | ERR_FOLDER_NOT_FOUND | This directory does not exist. |
| 4097 | ERR_FOLDER_ACCESS_DENY | You cannot access this directory. |
| 8196 | ERR_DUPLICATE_TASK | This task already exists. |
| 12288 | ERR_URL_NOT_SUPPORTED | This URL format is not supported. |
| 12289 | ERR_URL_DOWNLOAD_FAIL | URL download failed. |
| 12290 | ERR_PARSE_HOST_FAIL | Failed to parse the web address |
| 16384 | ERR_MAGNET_FORMAT | Incorrect Magnet format. |
| 16385 | ERR_TORRENT_FILE_NOT_EXISTS | The Torrent file was not found. |
| 16386 | ERR_TORRENT_FILE_FORMAT | Incorrect Torrent file format. |
| 20488 | ERR_DST_SPEACE_NOT_ENOUGH | Insufficient free space in destination folder. |

Source SHA256: libs/ds-all.js 4da2583104e9d6b70a4f8c79d0d7f64962ed97dde32d96bbc224772ccffd1de1; lang/ENG.js 05714173b0322d9fd6e989e1c96d813e07df04b53b2c7086c2f19f123bf6f3c5.

ENG-23 resolves as a bounded no-extraction decision: API explanations, task-row labels and tracker/NAS failure classification retain their distinct contexts. Corrected task labels cover URL format rather than only protocol, general URL download failure rather than only connection, and destination-folder free space rather than the entire appliance. Typed numeric lookup removes two assertions; no shared dictionary or classifier is forced merely to eliminate overlapping codes.


### Final consultation and evidence boundaries

Mimic supplied a fresh substantive review of the current feedback boundaries. Its confirmed page-owner, notification-episode and gray-attention cases were assigned to Terra for bounded corrective work; source suggestions are accepted only with reproduction and integration checks. The first reinjection-only test was not accepted as proof of extension reload. Unknown messaging acceptance is kept separate from an explicit worker rejection; a UI-only uncertainty wait must not trigger native fallback or release a still-pending duplicate-send claim. Three surface owners and distinct error texts remain intentional contracts.

The callable JSON schema now omits only redundant default screening/group fields, with defaults documented in its method string. Individual hashes, locations, scope, matching groups, type risks and manual evidence remain; no test/harness sources are excluded to stay below the formatter's 1 MiB file limit.

### Genuine retained-tab reload correction

The original repeat-init test was rejected as reload evidence. Enabling developer mode in the ephemeral Chromium profile allowed runtime.reload to execute, revealing zero AddUrl requests from the retained site. Three boundaries contributed: the update-only worker hook did not perform a refresh in this sequence, dynamic module reuse retained an invalidated runtime, and stale cleanup touched chrome.storage before removing its document listener. That exception left the obsolete capture handler ahead of its replacement, where stopImmediatePropagation blocked sending.

The correction uses the existing CRX standaloneFiles option for a fresh IIFE context, a session-lifetime refresh marker that survives worker suspension but resets on extension reload, and DOM-first cleanup before invalidated API access. It does not introduce a page reload, test-only injection, per-wake reinjection or native-success spam. BUG-79 records the mandatory real-reload browser acceptance; source and test deltas receive root review before their final hashes are accepted.

Codex rejected stopping at the replacement cleanup: the new isolated context cannot always reach the old cleanup through globalThis. The accepted capture boundary makes an invalidated old handler remove itself and return without preventDefault, stopImmediatePropagation, sending or native fallback. The fresh handler receives the same event. Genuine retained-tab magnet and Shift-file sends then pass with one NAS request each. This complements, rather than simulates, the real extension lifecycle.

### Final integrated acceptance

Root reviewed the full final deltas and strengthened stale-handler retirement assertions. The old-handler test fails with the guard removed, then passes after restoration. Session refresh is tested both across wakes and after reset; overlapping initial duplicate tests were combined into one meaningful lifecycle case.

The final registry inventories 2661 implementations in 216 files: 594 runtime, 153 tooling, 1871 tests and 43 harness. All 594 runtime implementations have current module/family evidence; two reviewed Vite tooling implementations bring the manual total to 596. Zero manual review records are stale. There are 23 whole-body candidate groups, including legitimate runtime wrappers and test repetition; this is not relabeled zero duplication. Runtime has zero explicit or recorded inferred any, zero double/non-null assertions, 37 ordinary assertions, six const assertions and the sanctioned logger lint exemption. Tests retain seven pragmatic any uses.

The compact JSON is 935686 bytes. Restoring redundant default screening/group fields would exceed the formatter's 1 MiB limit. The scanner preserves the full source/callable/test inventory and meaningful match/negative evidence rather than excluding hard-to-review code.

Fresh final checks passed: 595 unit/fixture tests across 41 files, 61 Chromium mock E2E, ten classifier repetitions, typecheck, Svelte (zero errors/warnings), lint, production/dev builds, 26 contrast checks, 28 deployment unit tests, Storybook build, and Firefox build/lint/package. Six production-bundle real-NAS spot checks passed and the owned-task ledger is empty. Firefox packaging is not Firefox runtime parity; Chrome notification creation is not OS-display proof. No release, version bump or store publication occurred.

Configured V8 coverage: statements 90.94%, branches 84.72%, functions 90.54%, lines 92.00%. Existing selected-TypeScript exclusions, including Svelte components and index entrypoints, remain unchanged. These percentages do not certify the whole product; browser scenarios cover named rendering/wiring boundaries. The prior failed CI classifier trace was investigated and its causal default-write race corrected, rather than bypassed with waits or weaker assertions.

BUG-64, BUG-65, BUG-66, BUG-71, BUG-77, BUG-78, BUG-79, ENG-23 and ENG-24 complete the bounded polish. Unreproduced BUG-70 and separate product decisions remain outside this acceptance. Documentation, scanner, language, Rulesync and actual staged-index checks accompany the accepted source evidence.
