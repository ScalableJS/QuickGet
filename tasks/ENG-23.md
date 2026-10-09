---
type: task
id: ENG-23
status: discussion
priority: p3
area: engineering/code quality
board: engineering
updated: 2026-10-09
audit_order: 8
---

# Decide shared QNAP error facts without flattening caller-specific messages

## Problem

API and task-card dictionaries overlap nine error codes with different wording; the card also owns 20488. Worker send/preflight classifiers match strings, while connectionHealth reads typed LoginError. These are related facts with distinct tracker/NAS/UI responsibilities; equivalence and firmware evidence must precede extraction.

## Acceptance criteria

- [ ] Compare the nine shared code meanings and task-only 20488 with authoritative existing evidence; do not invent or scrape new vendor facts by assumption.
- [ ] Define which facts are shared and which labels remain local; preserve reason/context text, login identity and tracker-vs-NAS distinction.
- [ ] Add a classification/equivalence matrix before replacing message matching or merging dictionaries.
- [ ] Keep unknown-code/custom-message fallback and current native silence/episode policy; coordinate broader delivery investigations through BUG-71.

## Evidence and scope

[The code-quality audit](../docs/quality/code-quality-audit.md) and [callable inventory](../docs/quality/functions.md) record source-grounded findings and review boundaries. This card is planned work, not an accepted runtime change. Test fixture any is explicitly allowed; no task is created merely to eliminate it.
