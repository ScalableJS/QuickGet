---
type: "task"
id: "ENG-7"
status: "done"
priority: "p3"
area: "tooling"
board: "engineering"
updated: "2026-10-09"
legacy_status: "Done"
size: "M"
---

# Establish a report-only dead-code baseline with Knip

**Priority:** P3 · **Size:** M · **Area:** tooling
**Files:** `package.json`, optional `knip.json` or equivalent, resulting task references

The external reviews were generated from incomplete Repomix snapshots and produced both real
findings and false positives. A repository-aware module graph is a better repeatable input, but an
unconfigured scanner can mistake Storybook stories, Vite entrypoints, Playwright fixtures and
scripts for dead code.

**Acceptance:** configure all production, test, Storybook, script and build entrypoints; run normal
and production-only Knip reports without `--fix`; classify every result as confirmed, dynamic
entrypoint, public/test contract, or false positive; and create narrowly scoped follow-up cards
only for confirmed findings. Do not make CI fail on the initial baseline and do not add blanket
ignores in place of correct entrypoint configuration.

**Completed 2026-09-15** — configured normal and production-only Knip reports without a CI gate or
blanket ignores. Findings were classified; confirmed new work is ENG-9/10 and missing `tsx`
remains owned by BUG-66.
