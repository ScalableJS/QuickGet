---
applyTo: '**/*.{ts,svelte}'
---

# Code Standard — TypeScript & Svelte (QuickGet Remote)

Adapted from the shared keabank frontend code standard, trimmed to this repo's stack:
a **Svelte 5 + TypeScript Chrome (MV3) extension**, built with Vite, linted/formatted by
**Biome**, tested with Vitest + Playwright. Only the parts that fit this project are kept;
React/Next/monorepo-specific rules from the source were dropped.

## Core principles

1. Prefer readability over micro-optimizations; let TypeScript inference work (add types mainly at boundaries).
2. Inline first — extract only when it truly helps (see below). No abstractions "for the future".
3. When refactoring, **reduce** code — don't reshuffle it. A refactor must remove code, clarify intent, reduce duplication, or improve correctness/performance (with evidence). Never "more lines, same meaning". (This is why we do **not** mass-convert existing `interface`→`type`.)

## TypeScript

- **`type` over `interface`** for new code. Use `interface` only when declaration merging is genuinely required (e.g. `ImportMetaEnv` in `env.d.ts`). Existing interfaces are left as-is unless the file is being reworked anyway.
- **Inline types for single-use shapes** (options objects, callback args). Extract a named `type` only when referenced in 2+ places.
- **Let inference work.** Don't annotate what TS already infers. Add types at boundaries (exported functions, props) or when inference widens to `any`.
- **No `any` / `as any`.** Prefer `unknown` and narrow. (The repo currently has zero `any` — keep it that way.)
- **Minimise `as` casts.** Allowed only at DTO/API boundaries (e.g. parsing untyped QNAP responses) and DOM lookups (`getElementById(...) as HTMLElement | null`). Prefer narrowing via type predicates / `.find()` over casting a value.
- Keep `strict: true` — never weaken `tsconfig.json` to silence errors.

## Svelte 5

- **Runes only.** Use `$state` / `$derived` / `$props` / `$effect`. No Svelte 4 leftovers (`export let`, `$:` reactive statements, `$store` autosubscription as the default API).
- **Derive, don't effect.** Compute with `$derived`; reserve `$effect` for genuine side effects (DOM, subscriptions, external sync). No effect that only assigns one `$state` from another.
- **Keep markup inline.** Extract a co-located component only when a block is large enough to hurt readability or is reused. Don't extract single-use presentational lists into config arrays.
- **`{#each}` for dynamic data** of unknown length (download list, search results). For a **fixed, compile-time-known** set (toolbar buttons, a handful of form fields), prefer explicit markup so each element stays greppable — don't disguise static markup as a `.map`/`{#each}` over a literal array.
- **No `console.*`** in popup/UI/Svelte code — Biome `noConsole` flags it. The only sanctioned logger is `src/lib/logger.ts` (used by the API client); background/service-worker `console.*` is exempt by config.

## File / module organisation

- **Main export at the top.** The reader sees the public API first; helpers, sub-components, and non-exported constants live **below** (hoisting makes this safe).
- **No separator comments** (`// --- helpers ---`). Structure speaks for itself.
- **Inline exports.** `export function name()` — not `function name()` + trailing `export { name }`.
- **Don't over-export.** Only `export` what another module imports; keep internal helpers unexported.
- **Single-use tiny components** stay co-located, not separate files; a separate file is justified only when reused or large enough to be its own module.

## Naming (this repo's convention)

- **Svelte components**: `PascalCase.svelte` (`DownloadItem.svelte`, `Settings.svelte`).
- **TS modules**: `camelCase.ts` (`downloadsManager.ts`, `batchUpload.ts`).
- **PascalCase** for exported types and components.
- **camelCase** for functions, variables, and feature-init functions (`initializeDownloads`).

## Imports

- Use the path aliases `@/`, `@api`, `@lib` for cross-folder imports; relative imports only within the same folder.
- `import type { … }` for type-only imports (Biome `useImportType` enforces it).
- Group order external → alias → relative; let Biome's organize-imports handle ordering.

## Formatting & lint (Biome — the single source of truth)

- Biome owns formatting (2-space indent, **line width 120**, LF). Don't hand-format against it; there is **no** Prettier/ESLint in this repo (legacy configs were removed).
- Don't commit code that fails `npm run lint` / `npm run typecheck` / `npm run check:svelte`.
- CI gate (`.github/workflows/ci.yml`) and the pre-push hook must stay green: **typecheck → unit tests → build → mock E2E**.
