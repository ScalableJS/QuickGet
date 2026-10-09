# QuickGet Remote — project instructions

A Svelte 5 + TypeScript Chrome (MV3) extension that sends downloads/torrents to a QNAP
NAS Download Station. Built with Vite, linted/formatted by **Biome**, tested with Vitest
(unit) + Playwright (E2E).

## Agent OS

This repo uses [Agent OS](https://github.com/buildermethods/agent-os). Product context and
machine-readable standards live in `agent-os/`:

- **`agent-os/product/`** — mission, roadmap and tech stack; the former kanban documents
  retain context and stable links to migrated cards.
- **`tasks/`** — canonical task files. Status lives in YAML frontmatter, never in a summary table.
  Read `tasks/README.md` for statuses and `tasks/TEMPLATE.md` for new work.
- **`views/tasks.base`** — Obsidian board and table derived from task metadata. Filter `board`
  for defects, settings UX, competitive gaps, engineering or demo recording.
- **`agent-os/standards/`** — canonical engineering conventions, indexed in `index.yml`.
  Commands are generated from `.rulesync/commands/agent-os/` to
  `.claude/commands/agent-os/`; skill wrappers are generated from `.rulesync/skills/`.

Before substantial work: check tasks with `todo`, `doing`, `review`, `blocked`, `partial`,
`deferred` or `discussion` status, then read the relevant standards from the index.
Closed statuses are `done` and `rejected`. Preserve existing task IDs and dated evidence.

## Rulesync

Project instructions are generated from `.rulesync/rules/project.md`; project skills from
`.rulesync/skills/`. Edit those sources, then run `rulesync generate` and
`rulesync generate --check`. `rulesync.jsonc` declares the supported agents.
Do not edit generated `AGENTS.md`, `CLAUDE.md`, or Copilot instructions directly.
Global rules and MCP configuration belong to `~/.ai-rulesync/.rulesync/`.

## Code standards — read before writing code

Follow the repo code standard and review guide in `.github/instructions/`:

- **[.github/instructions/code-standard.instructions.md](.github/instructions/code-standard.instructions.md)** — TypeScript & Svelte 5 rules: `type` over `interface` (new code), no `any`, minimal `as`, runes-only Svelte, derive-don't-effect, inline-first, main-export-at-top, naming, imports, Biome formatting.
- **[.github/instructions/code-review.prompt.md](.github/instructions/code-review.prompt.md)** — review priorities and categories.

## Must stay green

`.github/workflows/ci.yml` gates on **typecheck → Svelte check → lint → unit tests → build → mock E2E**.
The local pre-push hook runs typecheck; run the full checks below before finishing changes.
Before finishing any change run, at minimum:

```bash
npm run typecheck && npm run check:svelte && npm run lint && npm test && npm run build
```

Everything above answers questions asked of `mockNas.ts`, a mock written to answer them. **Before a
release, `npm run test:prod-spotcheck` runs four scenarios against the real NAS** — the only step in
the path to the Web Store that speaks to a QNAP. It cannot run in CI (no route to the NAS, and the
credentials are deliberately outside Actions), so it is a local gate: see `tests/e2e/README.md`.
Skipping it silently is how a feature shipped that returned `12288` on its first real click.

## Conventions specific to this repo

- **Branching and releases:** work and push directly in `env/dev`; do not create pull requests targeting it. Release only through a pull request from `env/dev` to `env/prod`. `env/prod` is the only branch allowed to publish to the Chrome Web Store; do not push routine changes to it directly. A release PR is opened only after the production spot check has passed, or with an explicit note in the body saying why it could not run.
- **Commits:** conventional-commit style with optional scope (`feat(settings): …`, `fix(background): …`, `chore: …`). This repo is **not** a keabank repo — do not use KSP-ticket commit prefixes.
- **Logging:** the only sanctioned logger is `src/lib/logger.ts` (used by the API client). No `console.*` in popup/UI/Svelte code (Biome `noConsole`); background/service-worker `console.*` is exempt by config.
- **API:** QNAP DS V4 `AddUrl`/`AddTorrent` require both `temp` and `move` — see `src/api/client.ts`.
