---
type: task
id: ENG-23
status: done
priority: p3
area: engineering/code quality
board: engineering
updated: 2026-10-10
audit_order: 8
---

# Decide shared QNAP error facts without flattening caller-specific messages

## Problem

API and task-card dictionaries overlap nine error codes with different wording; the card also owns 20488. Worker send/preflight classifiers match strings, while connectionHealth reads typed LoginError. These are related facts with distinct tracker/NAS/UI responsibilities; equivalence and firmware evidence must precede extraction.

## Acceptance criteria

- [x] Compare the nine shared code meanings and task-only 20488 with authoritative existing evidence; do not invent or scrape new vendor facts by assumption.
- [x] Define which facts are shared and which labels remain local; preserve reason/context text, login identity and tracker-vs-NAS distinction.
- [x] Add a classification/equivalence matrix before replacing message matching or merging dictionaries.
- [x] Keep unknown-code/custom-message fallback and current native silence/episode policy; coordinate broader delivery investigations through BUG-71.

## Evidence and scope

[The code-quality audit](../docs/quality/code-quality-audit.md) and [callable inventory](../docs/quality/functions.md) record source-grounded findings and review boundaries. This card is planned work, not an accepted runtime change. Test fixture any is explicitly allowed; no task is created merely to eliminate it.


## Comparison: 2026-10-09

[The source-grounded matrix](../docs/quality/code-quality-audit.md#error-fact-comparison-for-eng-23) records all nine overlapping codes and task-only 20488, distinct unknown-code/reason fallbacks, and NAS-login versus tracker-handoff classifier boundaries. No shared dictionary/classifier is accepted: 12288/12289 row labels narrow the API fact, and independent 20488 vendor evidence is still missing. This card remains discussion; the comparison is not a fresh NAS observation.


## Polish execution: 2026-10-10

Terra owns the bounded implementation/reproduction work; Codex owns review, Mimic consultation, integrated verification and acceptance. This starts the current polish pass without closing historical evidence gaps.


## Decision and vendor evidence: 2026-10-10

Public assets from the installed Download Station independently confirm all nine shared codes and 20488. [The audit](../docs/quality/code-quality-audit.md#vendor-error-fact-verification) records mapping keys, meanings and source hashes without NAS address/credentials. Caller contexts and unknown-code/custom-message fallbacks remain distinct, so no universal dictionary/classifier is extracted. Task labels for 12288/12289/20488 are corrected to the vendor's full scope; numeric lookup removes two casts. Three new wording regressions failed before correction and passed afterward. Final integrated acceptance is pending.


## Accepted polish: 2026-10-10

Codex accepted the bounded source/test delta after Terra implementation and substantive Mimic consultation. Fresh integration passed 595 unit/fixture tests, 61 Chromium mock E2E, ten consecutive classifier repetitions, typecheck, Svelte (zero errors/warnings), lint, production build and six real-NAS spot checks; the owned-task ledger is empty. [The final audit](../docs/quality/code-quality-audit.md#final-integrated-acceptance) and [verification](../docs/system/verification.md#final-polish-integrated-acceptance-2026-10-10) retain exact scope and coverage limits. No release or store publication is performed.
