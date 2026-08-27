# QuickGet Remote — project instructions

A Svelte 5 + TypeScript Chrome (MV3) extension that sends downloads/torrents to a QNAP
NAS Download Station. Built with Vite, linted/formatted by **Biome**, tested with Vitest
(unit) + Playwright (E2E).

## Agent OS

This repo uses [Agent OS](https://github.com/buildermethods/agent-os). Product context and
machine-readable standards live in `agent-os/`:

- **`agent-os/product/`** — `mission.md` (problem, users, principles, non-goals),
  `roadmap.md` (phases; details in `docs/feature-roadmap.md`), `tech-stack.md`,
  and **`bugs-kanban.md` — the single source of truth for open defects.**
- **`agent-os/standards/`** — concise, injectable rules, listed in `index.yml`.
  Read the index first and pull only what the task needs; `/inject-standards` does this
  for you. Commands live in `.claude/commands/agent-os/`, skills in `.agents/skills/`.

Before starting work: check `bugs-kanban.md` for a card covering it, and read the standards
relevant to the area you are touching.

## Code standards — read before writing code

Follow the repo code standard and review guide in `.github/instructions/`:

- **[.github/instructions/code-standard.instructions.md](.github/instructions/code-standard.instructions.md)** — TypeScript & Svelte 5 rules: `type` over `interface` (new code), no `any`, minimal `as`, runes-only Svelte, derive-don't-effect, inline-first, main-export-at-top, naming, imports, Biome formatting.
- **[.github/instructions/code-review.prompt.md](.github/instructions/code-review.prompt.md)** — review priorities and categories.

## Must stay green

`.github/workflows/ci.yml` and the pre-push hook gate on: **typecheck → unit tests → build → mock E2E**.
Before finishing any change run, at minimum:

```bash
npm run typecheck && npm run check:svelte && npm run lint && npm test && npm run build
```

## Conventions specific to this repo

- **Branching and releases:** work and push directly in `env/dev`; do not create pull requests targeting it. Release only through a pull request from `env/dev` to `env/prod`. `env/prod` is the only branch allowed to publish to the Chrome Web Store; do not push routine changes to it directly.
- **Commits:** conventional-commit style with optional scope (`feat(settings): …`, `fix(background): …`, `chore: …`). This repo is **not** a keabank repo — do not use KSP-ticket commit prefixes.
- **Logging:** the only sanctioned logger is `src/lib/logger.ts` (used by the API client). No `console.*` in popup/UI/Svelte code (Biome `noConsole`); background/service-worker `console.*` is exempt by config.
- **API:** QNAP DS V4 `AddUrl`/`AddTorrent` require both `temp` and `move` — see `src/api/client.ts`.
