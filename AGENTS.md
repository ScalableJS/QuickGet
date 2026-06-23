# QuickGet Remote — project instructions

A Svelte 5 + TypeScript Chrome (MV3) extension that sends downloads/torrents to a QNAP
NAS Download Station. Built with Vite, linted/formatted by **Biome**, tested with Vitest
(unit) + Playwright (E2E).

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

- **Branching and releases:** work from `env/dev` and push release changes there directly; do not create pull requests targeting `env/dev`. Only pushes to `env/dev` are release candidates and may publish the Chrome extension; do not use `env/prod` for routine work or releases.
- **Commits:** conventional-commit style with optional scope (`feat(settings): …`, `fix(background): …`, `chore: …`). This repo is **not** a keabank repo — do not use KSP-ticket commit prefixes.
- **Logging:** the only sanctioned logger is `src/lib/logger.ts` (used by the API client). No `console.*` in popup/UI/Svelte code (Biome `noConsole`); background/service-worker `console.*` is exempt by config.
- **API:** QNAP DS V4 `AddUrl`/`AddTorrent` require both `temp` and `move` — see `src/api/client.ts`.
