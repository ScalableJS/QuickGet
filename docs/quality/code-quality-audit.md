---
type: research
status: active
area: engineering
updated: 2026-10-09
---

# Code quality and algorithm duplication audit

This audit covers the current env/dev runtime at eee8364 plus the audit tooling in this change. It creates review evidence and prioritized tasks; it does not change runtime behavior. Tests may use pragmatic any for concise mocks and fixtures. Production contracts remain subject to the no-any and minimal-assertion standard.

## Inventory and limits

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

## Type quality

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
