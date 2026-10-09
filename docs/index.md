---
type: reference
status: active
area: project
updated: 2026-10-09
---

# Documentation home

QuickGet Remote is a browser client for one QNAP Download Station. Open the repository root
as an Obsidian vault: pages, task files, wikilinks, backlinks and Bases form a local knowledge base.

## Start here

- [[docs/system/overview|What the product does and how its parts connect]]
- [[docs/system/README|Current system guide]]
- [[docs/system/coverage|Documentation coverage and review state]]
- [[docs/system/feature-review|Unused candidates, distinct paths, and behavior gaps]]
- [[docs/system/notification-normalization-audit|Popup feedback audit, test gaps, and normalization plan]]
- [[docs/quality/code-quality-audit|Code quality, callable inventory and algorithm duplication]]
- [[docs/handoff/current|Current handoff and open work]]
- [Documentation catalog](../views/documentation.base) and [task board](../views/tasks.base)

## Sources of truth

| Knowledge | Owner |
|---|---|
| Current functionality | `docs/system/` and authoritative module README pages |
| Feature/source/evidence mappings | [features.json](features.json) |
| Mission, roadmap, stack | [Agent OS product context](../agent-os/product/mission.md) |
| Engineering conventions | [Agent OS index](../agent-os/standards/index.yml) |
| Open and historical task state | [Task frontmatter](../tasks/README.md) |
| Agent instructions and procedures | `.rulesync/rules`, `.rulesync/commands`, `.rulesync/skills` |

## Deeper references

[API module](../src/api/README.md), [toolbar state](toolbar-actions.md),
[routing test matrix](routing-coverage.md), [QNAP capabilities](qnap-download-station-capabilities.md),
[local development](local-development.md), [test operations](../tests/e2e/README.md),
[Firefox releases](firefox-release-guide.md), and [Web Store guide](../CHROMEWEBSTORE.md)
remain maintained references. Their scope is narrower than the whole product.

[Competitor research](competitor-analysis.md), [tracker research](competitor-routing-teardown.md),
[spacing research](design-system-spacing-research.md), and [Synology analysis](synology-download-station-analysis.md)
are research inputs. Synology support is not a shipped feature.

[Svelte migration](svelte-migration-plan.md), [popup refactoring](popup-refactoring-plan.md),
[settings UX analysis](settings-ux-plan.md), [interception investigation](download-interception-bugs.md),
and [cache options](cache-options.md) retain historical reasoning. Read their status/date before
applying a design; history does not override the current system pages.

The old `agent-os/product/*-kanban.md` pages retain context and stable links. Their former
summary tables do not own task status. [[docs/system/documentation|The documentation workflow]]
explains reviews, drift detection, English prose, and the limits of coverage percentages.
