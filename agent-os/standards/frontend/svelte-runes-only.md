# Svelte 5 Runes Only

Injectable summary. Canonical, fuller version:
`.github/instructions/code-standard.instructions.md` — edit that file, then re-condense here.

All Svelte code uses the runes API — no Svelte 4 patterns.

- Use `$state` / `$derived` / `$props` / `$effect`. No `export let`, no `$:` reactive statements, no `$store` autosubscription as the default API.
- Derive, don't effect: compute with `$derived`; reserve `$effect` for genuine side effects (DOM, subscriptions, external sync). No effect that only assigns one `$state` from another.
- No `console.*` in popup/UI/Svelte code (Biome `noConsole`); the only sanctioned logger is `src/lib/logger.ts`. Background/service-worker `console.*` is exempt by config.
