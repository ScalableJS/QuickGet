---
type: reference
status: active
area: documentation
updated: 2026-10-09
features: ["documentation-workflow"]
---

# Documentation ownership and coverage workflow

## Knowledge base

Open the repository root as an Obsidian vault. [[docs/index|Documentation home]] and [[docs/system/README|System guide]] are entrypoints. Pages use English text, stable paths, frontmatter (`type`, `status`, `area`, `updated`, `features`), standard Markdown links, and Obsidian wikilinks with aliases. `views/documentation.base` is the page catalog; `views/tasks.base` is the task board. Base Board is needed for the existing kanban view; table views use Obsidian Bases. No plugin is installed automatically.

Current behavior belongs to system pages or an existing authoritative module README, never to a second copied README. Historical analyses and old task text remain available as reasoning, not automatically current truth. Agent OS continues to own its standards and product documents. Done tasks are retained here for existing links/history; importing the family-tracker coverage method does not import that project's task-deletion policy.

## Registry and metrics

[features.json](../features.json) maps stable feature IDs to canonical pages, owning sources, and evidence. A small helper belongs to the feature it supports; there is no requirement for one page per function. Product `implementation: partial` and review `assessment: partial` are different. Planned features do not enter the denominator. Exclusions require a concrete reason. Shared sources can belong to multiple features and invalidate each when changed.

[[coverage]] distinguishes linked L/N from reviewed-and-unchanged V/N. The initial inventory is explicit and can miss behavior inside an existing source file; a high score does not prove universal discovery, usefulness, correctness, or live NAS compatibility. Hash drift means needs-review, not proof that the prose is wrong. The report is generated explicitly; ordinary checking is read-only.

## Changing a feature

1. Find the changed source in registry `sources` and review its owning pages.
2. Compare observable behavior, data boundaries, failure paths, and limits with the current implementation/tests.
3. Update the canonical page, or record a specific reason why its description remains accurate.
4. Review one feature explicitly:

```sh
node scripts/docs/review.mjs feature-id --reviewer "reviewer name" --reason "what behavior and evidence were compared" --assessment verified
npm run docs:report
npm run docs:check
```

`review.mjs` has no bulk refresh option. A doc-only diff or touching a page does not certify implementation. Never update snapshots merely to silence the gate. `partial`/`missing` and explicit initial review debt stay visible. Debt cannot expand against `--base`; deleting a feature or hiding it as planned requires a reviewed retirement reason.

## New sources and staged checks

The checker independently scans runtime sources, operational scripts, Storybook configuration, build configuration/manifests, workflows, and fixture/mock support sources. New files need a feature owner or a specific exclusion. New behavior inside an existing file still requires review; this project has no public server-route inventory to pretend otherwise.

Registry paths and local Markdown headings/wikilinks are checked. External URLs are links, not a network gate. The checker uses Node stdlib and requires no NAS credentials. After staging the intended files, inspect the actual Git index:

```sh
npm run test:docs
node scripts/docs/check.mjs --strict --base HEAD --staged
```

A working-tree snapshot does not certify staged sources. `--staged` checks an isolated copy of the index and is read-only. Workflow execution does not establish required-branch-check settings on GitHub.

## Language and dead-code findings

Maintained prose/comments/descriptions are English. Unicode test literals intentionally exercise non-Latin input and are documented exceptions; the language guard is a Cyrillic regression check, not a general linguistic classifier. [[feature-review]] records dead-code candidates and behavioral differences with source evidence. Product code is removed only in its own task after proving ownership and running relevant checks.
