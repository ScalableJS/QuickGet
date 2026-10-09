# Project tasks

Each `BUG-`, `UX-`, `GAP-`, `RES-`, `ENG-` or `DEMO-` file is one canonical task.
Its YAML frontmatter owns current status. [The Obsidian Base](../views/tasks.base)
provides a kanban and a sortable table; filter `board` to select a workstream.
Agent OS owns engineering standards and product context, while `tasks/` owns work state.

## Metadata

Required: `type: task`, unique `id`, `status`, `priority` (`p0`–`p3`), `area`,
`board`, and `updated` (`YYYY-MM-DD`). Board values are `bugs`, `settings-ux`,
`competitive-gaps`, `engineering`, and `demo-video`. Preserve the existing ID prefixes.
Optional: `severity`, `size`, and `depends_on` (a list of task IDs).

| Status | Meaning |
|--------|---------|
| discussion | Approach needs a decision before implementation |
| todo | Ready backlog |
| doing | Work in progress |
| review | Implementation awaiting review or verification |
| blocked | Cannot proceed; record the dependency or blocker |
| partial | Some acceptance criteria proven; record the remaining work |
| deferred | Deliberately postponed, still open |
| rejected | Closed without implementation; record why |
| done | Accepted outcome or completed decision, supported by evidence |

To move a card, edit `status` and `updated` in its task file and append a dated
explanation or evidence in the body. Do not maintain status in the old summary documents.
Use [TEMPLATE.md](TEMPLATE.md) for new tasks. Evidence must distinguish mocked tests
from a real-NAS spot check; release requirements remain in the release skill.

## Migration from the old boards

On 2026-10-09, all 136 cards from the five `agent-os/product/*-kanban.md` files
were migrated, preserving IDs, descriptions, acceptance conditions and dated history.
Those documents retain context, non-card notes and the original card anchors as links.
Relative Markdown links in task descriptions were rebased to the new directory.

The summary table's status was authoritative in the old format. Some card headers
were stale even though the table and later resolution history said `Done`.
Current status comes from that table; historical prose is preserved and is not re-attested.
`legacy_status` records the original table value. `updated` marks the migration date,
not a new claim that historical work was tested on that date.

Status mapping: `Backlog` → `todo`, `In Progress` → `doing`, `In Review` → `review`,
`Discussion` → `discussion`, `Deferred` → `deferred`, `Rejected` → `rejected`,
`Done` → `done`. `Decided: no library` → `done` because UX-2 is a completed decision.
No deferred task was silently closed.

Existing engineering priorities were retained. Bug severity maps `high` → `p1`,
`medium` → `p2`, `low` → `p3`. Other cards default to `p2`; this is a migration
sorting default, not a fresh prioritization. Size and bug severity remain separate metadata.
