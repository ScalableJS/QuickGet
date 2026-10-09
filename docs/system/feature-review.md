---
type: research
status: active
area: engineering
updated: 2026-10-09
---

# Feature inventory: duplication, unused code, and gaps

This review compares the shipped paths, current call sites, existing task acceptance conditions, and a fresh report-only Knip run. It records findings; it does not authorize removal of active behavior or close old defects without reproduction.

## Verified cleanup boundaries

| Candidate | Evidence | Action |
|---|---|---|
| `chrome-webstore-upload` direct dev dependency | No source import; `scripts/upload-webstore.js` implements Store calls directly | Removed through [ENG-9](../../tasks/ENG-9.md) |
| Direct `@storybook/svelte` and `@unocss/preset-wind4` dependencies | Source uses the Vite adapter and `unocss`; packages arrive transitively | Direct declarations removed; extension and Storybook builds passed; transitive packages remain |
| `Card.svelte` and its barrel export | Knip flags the export; no runtime/gallery consumer found | Removed through [ENG-10](../../tasks/ENG-10.md) |
| `isPinnedToToolbar()` and `persistHttpCapture()` | No caller found; adjacent helpers remain live | Removed; popup sizing and HTTP bundle capture callers remain live |

Unused exports of task-status sets and error formatters do not imply unused implementations: internal use must be preserved. `@types/chrome` provides the global Chrome namespace and is not removable just because Knip has no import edge. ffmpeg is an external demo tool, not an extension runtime dependency.

## Similar paths with distinct responsibilities

| Paths | Why both exist | Consolidation verdict |
|---|---|---|
| Browser torrent vs page magnet/file handler | Descriptor lifecycle/cancellation vs navigation/message ownership | Distinct active behavior; no deletion |
| Context-menu send vs page ordinary-file send | Same transport, different user intent/feedback | Already share `sendDownloadToStation()` |
| Popup vs worker API caches | Separate browser contexts and lifetimes | Shared connection identity helper; independent caches are necessary |
| `onCreated`, `onChanged`, deferred filename callback | One lifecycle, metadata becomes known at different times | One synchronous in-flight claim; no proven duplicate listener |
| UI lock vs NAS credential storage | Casual settings access vs autonomous worker authentication | Different boundaries; neither is credential encryption |
| Page toast, popup status, system notification | Different visible contexts | Policy consistency work, not simple redundant widgets |

[ENG-11](../../tasks/ENG-11.md) records the prior request-count audit. No reproduced second NAS request permits deleting a lifecycle listener or inventing persistent dedupe.

## Behavioral gaps and documentation corrections

| Finding | Current evidence | Follow-up |
|---|---|---|
| Batch URLs do not evaluate routing rules per line | `batchUpload.ts` calls `addUrls()`; the API maps each URL to `addUrl()` with one destination | [ENG-13](../../tasks/ENG-13.md): decide/document consistent destination policy before changing behavior |
| Feedback differs by path; original BUG-71 popup diagnosis is stale | Popup uploads now emit terminal success, while torrent/menu successes are silent | [BUG-71](../../tasks/BUG-71.md) stays open; audit note corrects the matrix |
| Full task query is used for background badge polling | `alarms.ts` calls `queryTasks()`, not `getStatus()` | Existing [BUG-39](../../tasks/BUG-39.md) |
| Manual stand relies on undeclared `tsx` | `package.json` stand command; Knip missing binary | Existing [BUG-66](../../tasks/BUG-66.md) |
| Security mission/privacy text claimed old session-only/encrypted storage | `saveSettings()` writes local password; lock is PBKDF2 UI verifier only | Current mission/privacy/config comment corrected; no storage behavior changed |
| Firefox parity is not proved by packaging | Optional Chromium filename callback; mock suite runs Chromium | [ENG-14](../../tasks/ENG-14.md): establish explicit Firefox runtime verification |
| Historical plans describe superseded architecture | Svelte/UnoCSS conversion and old encryption decisions already shipped | Old plans labeled historical; current pages linked |

## Verification limits

Knip results are candidates, not a proof of product redundancy. No usage telemetry exists, so low user demand cannot be inferred from imports. No real-NAS recurrence of BUG-70 was captured in this audit. The new documentation checker cannot infer a new feature inside an old file or prove that feature descriptions are honest; explicit review owns that responsibility.


## Follow-up popup audit: 2026-10-09

[[notification-normalization-audit|The feedback audit]] records actual test coverage and
confirmed lifecycle failures. A production call-site search additionally found that
`downloadsManager.ts` built a duplicate-detection snapshot with no reader or subscriber.
[ENG-16](../../tasks/ENG-16.md) removes its construction, producer and listeners while preserving live selection state.
[ENG-15](../../tasks/ENG-15.md) gates normalization on behavior-level unit and browser regressions.
These findings do not authorize merging unrelated caches, transport paths or presentation state.

The Agent OS MV3 standard was also compared with the current worker: it now permits ephemeral
in-flight claims/cache state, requires NAS acceptance before browser cancellation, and describes
current credential preconditions. Retired pause/recovery and settings-lock interception guidance
was removed from the canonical standard; no worker policy was changed by that correction.
