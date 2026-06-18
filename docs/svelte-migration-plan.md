# Svelte Migration Plan — QuickGet Remote

Status: **largely complete** · Target: Svelte 5 (runes) · Owner: TBD

## Migration status (final)

| Phase | Scope | State |
|---|---|---|
| 0 | Tooling + spike | ✅ done |
| 1 | Downloads list (`DownloadItem`/`DownloadsList`); remove morphdom | ✅ done |
| 2 | Settings panel (`Settings.svelte`) | ✅ done |
| 3 | Toolbar (`Toolbar.svelte`) | ✅ done |
| 5 | Folder chooser (`Chooser.svelte`) | ✅ done |
| 6 | Cleanup (dead string renderers, `render/`, dead toolbar state) | ✅ done |
| 4 | Single-root `App.svelte` + migrate upload/debug | ⏸ **deliberately skipped** |

**All genuinely component-worthy UI is now Svelte** (list rendering, settings
form, toolbar, chooser), and `morphdom` is gone. The popup uses Svelte "islands"
mounted into the existing HTML shell; Rollup hoists the shared Svelte runtime
into a common chunk, so the popup entry is small (~10 KB gzip) again.

**Why Phase 4 is skipped (engineering judgment):** the remaining vanilla code is
non-visual imperative glue — the upload **file picker** (hidden `<input>` + dialog),
the debug **log panel** (buffer + clipboard), and the **status toast**. Svelte adds
no meaningful value there, and folding them plus a single bootstrap root carries
real regression risk for ~zero user benefit. The plan's own checkpoint (§9)
sanctions stopping when the remaining win is marginal. Revisit only if these
areas gain genuinely reactive UI. Validated end-to-end by the Playwright
full-cycle mock-NAS e2e after every phase.

Target: Svelte 5 (runes).

## 1. Goal & scope

Migrate the **UI layer** of the extension from hand-written DOM + `morphdom` to
**Svelte 5**, improving maintainability of the popup/options/chooser without
growing the bundle meaningfully.

### In scope (the DOM-rendering layer)
- `src/popup/**` — popup root, features (`downloads`, `upload`, `settings`,
  `toolbar`, `debug`), components (`downloadItem`, `statusPill`), shared `dom/`.
- `src/chooser/**` — folder chooser window.
- Storybook stories.

### Out of scope (stays vanilla TS — no DOM, framework-agnostic)
- `src/background/**` — service worker (alarms, menus, downloads interception).
  **Never touch.** A UI framework has no place in a service worker.
- `src/lib/**` — `settings`, `config`, `tasks`, `torrentSender`, `logger`.
- `src/api/**` — typed client + schema.
These are pure logic and already framework-independent — Svelte imports them as-is.

### Non-goals
- No behavioural changes. Pixel/behaviour parity is the acceptance bar.
- No rewrite of the QNAP API contract or settings shape.

## 2. Why Svelte (recap)
- Compiles to plain JS — **~1–3 KB runtime**, vs ~45 KB for React. Critical for a
  popup that must open instantly and a service worker with cold starts.
- Replaces the `morphdom` diffing we already do by hand with first-class
  reactivity — net code reduction, not addition.
- Svelte 5 output is **CSP-safe** (no `eval`/`new Function`), required by MV3.
- Alternative considered: Preact (lower migration risk, JSX). Svelte chosen for
  smallest runtime + least boilerplate; revisit if the team prefers JSX.

## 3. Tooling changes

| Concern | Today | After |
|---|---|---|
| Compiler | — | `svelte` + `@sveltejs/vite-plugin-svelte` |
| Bundler | Vite + `@crxjs/vite-plugin` | unchanged (crxjs supports the Svelte plugin) |
| Type-check | `tsc --noEmit` | add `svelte-check` (tsc can't see `.svelte`) |
| Lint/format | Biome | Biome for `.ts`; **Biome cannot parse `.svelte`** → add `prettier` + `prettier-plugin-svelte` (or `eslint-plugin-svelte`) for `.svelte` only |
| Unit tests | Vitest + jsdom | add `@testing-library/svelte` + `@vitest/plugin` (vitest-svelte) |
| Component dev | Storybook `@storybook/html-vite` | swap to `@storybook/svelte-vite` |
| E2E | Playwright | unchanged (asserts rendered DOM) |

> **Key caveat:** Biome has no `.svelte` support. Either keep `.svelte` thin
> (logic in imported `.ts`, markup in template) so most code stays Biome-linted,
> or accept Prettier as a second formatter for `.svelte` files. Decide in Phase 0.

## 4. Architecture mapping

| Current | Svelte 5 |
|---|---|
| `renderDownloadItem(task): string` + `morphdom` | `DownloadItem.svelte` (`$props`), keyed `{#each}` in the list |
| `downloadsState.ts` mutable state | `$state` rune in a `downloads.svelte.ts` module, or a store |
| `downloadsManager.ts` (fetch/refresh orchestration) | **kept as-is**; the Svelte component subscribes to its output |
| `settingsUI.ts` `getFormElements`/`fill`/`read` | `Settings.svelte` with `bind:value` — deletes the manual DOM plumbing |
| `shared/dom/morphdom.ts` | **removed** at the end (Phase 4) |
| `autoRefresh.ts` | unchanged (timer logic), drives a `$state` |

State stays in plain `.svelte.ts` modules using runes so logic remains testable
without mounting components.

## 5. Phased rollout (incremental, shippable after each phase)

Each phase ends green on `tsc`/`svelte-check`/tests/build and is independently
loadable in Chrome. Stop after any phase with a working extension.

### Phase 0 — Spike & tooling (½ day)
- Add `svelte`, `@sveltejs/vite-plugin-svelte`, `svelte-check`, testing deps.
- Wire the Svelte plugin into `vite.config.ts` alongside `crx`.
- Build a throwaway `Hello.svelte` mounted in the popup; load unpacked in Chrome.
- **Validate the two real risks: crxjs+Svelte HMR works, and the production
  build passes MV3 CSP** (no inline/eval violations in the SW console).
- Decide the Biome-vs-Prettier split for `.svelte`.

### Phase 1 — Leaf components (1 day)
- Convert `statusPill` and `downloadItem` to `.svelte`.
- Mount them imperatively where the list currently injects HTML strings (Svelte
  `mount()` into existing nodes) — list orchestration untouched yet.
- Port `downloadItem.stories.ts` to Svelte CSF.
- Parity check: seeding metrics, progress bar, status labels render identically.

### Phase 2 — Settings panel (1 day)
- Replace `settingsUI.ts` form plumbing with `Settings.svelte` (`bind:value`,
  the 3-way intercept-mode `<select>`, destination-folders `<textarea>`).
- Keep `settings/index.ts` save/restore/test-connection orchestration; the
  component calls into it. This deletes the most boilerplate-heavy file.

### Phase 3 — Downloads list + toolbar (2 days)
- `Downloads.svelte` renders the list via keyed `{#each}` driven by `$state`
  fed from `downloadsManager`/`autoRefresh`. **Remove `morphdom` here.**
- `Toolbar.svelte` for toolbar actions/state.

### Phase 4 — Popup root + remove morphdom (1 day)
- Convert popup entry to a single `App.svelte` mounting the feature components.
- Delete `shared/dom/morphdom.ts` and drop the `morphdom` dependency.

### Phase 5 — Chooser window (½ day)
- Convert `src/chooser/index.ts` → `Chooser.svelte` (folder picker, duplicate /
  resume inline UI).

### Phase 6 — Cleanup (½ day)
- Remove dead string-render helpers, finalize stories, update README/CLAUDE.md,
  ensure Playwright specs still pass against the new DOM.

**Rough total: ~6–7 focused days**, fully incremental.

## 6. Testing strategy
- **Unit:** existing `lib`/`api` tests untouched. Add `@testing-library/svelte`
  tests for components (render → assert DOM). State-rune modules tested directly.
- **Visual:** Storybook (svelte-vite) for `DownloadItem`/`StatusPill` across all
  task statuses (downloading, seeding, paused, error, finished).
- **E2E:** Playwright mock-NAS + full-cycle specs are the regression net — they
  assert behaviour, not implementation, so they should pass unchanged.

## 7. MV3 / CSP notes
- Svelte 5 compiled output contains no `eval`/`Function` → satisfies MV3 CSP.
- Dev-mode HMR injects a websocket client; crxjs already manages the CSP relaxation
  for unpacked dev builds. Verify in Phase 0.
- Service worker stays vanilla — zero Svelte in `background/`.

## 8. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Biome can't lint `.svelte` | Keep components thin; add Prettier for `.svelte` only |
| crxjs + Svelte HMR/CSP surprises | De-risked first in Phase 0 spike before committing |
| Behaviour drift during port | Playwright specs + per-phase parity checks |
| Storybook addon churn (html→svelte) | Swap builder in Phase 0; stories ported per component |
| Scope creep into background SW | Hard rule: SW and `lib/` stay vanilla |

## 9. Decision checkpoints
1. **After Phase 0:** does crxjs+Svelte+CSP hold, and is the Biome/Prettier split
   acceptable? If not → fall back to Preact (JSX, Biome-lintable) or abort.
2. **After Phase 3:** is the bundle/UX better than vanilla+morphdom? If the win is
   marginal, it is valid to stop here with a partially-migrated, still-working UI.

## Phase 0 — Results (spike completed, branch `spike/svelte-phase0`)

Validated on Svelte **5.56**, `@sveltejs/vite-plugin-svelte@3.1`, `svelte-check@4`,
Vite 5, crxjs 2.

| Check | Result |
|---|---|
| crxjs + Svelte build | ✅ builds clean (`Hello.svelte` mounted in real popup footer) |
| `tsc --noEmit` (with `/// <reference types="svelte" />` in `env.d.ts`) | ✅ pass |
| `svelte-check` (new `check:svelte` script) | ✅ 0 errors / 0 warnings |
| MV3 CSP | ✅ default CSP, **no custom policy needed**; `0` `eval`/`new Function` in bundle |

**Version pinning finding (the real risk surfaced):**
`@sveltejs/vite-plugin-svelte@7` peer-requires **Vite 8**; this repo is on Vite 5.
Resolved by pinning the plugin to **v3** (supports Vite 5 + Svelte 5). v3 is in
maintenance mode — it works, but before/during full migration decide:
- **(A)** stay on plugin v3 + Vite 5 (zero churn now), or
- **(B)** upgrade Vite 5→8 + plugin→latest (bigger change; check crxjs's Vite peer range first).
Recommendation: stay on (A) for the migration; treat the Vite 8 upgrade as a
separate, independent task.

**Bundle cost (transitional):** popup JS went 24.7 KB → 54.7 KB (gzip 8.7 → 19.9 KB)
because the spike adds the Svelte runtime *on top of* all existing vanilla code +
`morphdom`. This is expected during coexistence; the runtime is paid down as
vanilla render code and `morphdom` are removed in Phases 3–4.

**Biome finding (confirmed live):** Biome tried to lint `Hello.svelte` and threw
false "unused variable" errors — it cannot parse Svelte templates. Resolved by
adding `"!**/*.svelte"` to `biome.json` → `files.includes`. `.svelte` files are now
covered by `svelte-check` only; a Prettier-for-svelte pass can be added later for
formatting if desired.

**Spike artifacts to remove when starting Phase 1:** `src/popup/Hello.svelte`, the
`#svelte-probe` div in `popup/index.html`, and the mount block in `popup/index.ts`.

**Verdict: GO.** No blocking issues. Proceed to Phase 1 (leaf components).

## Post-migration: icon strategy (status glyphs → SVG)

The popup currently uses emoji glyphs for statuses (`▶ 🌱 ⏸ ✗` …), which render
inconsistently across OSes. Once items are Svelte components, replace them with
real SVG icons. **Hard constraint: MV3 CSP forbids runtime fetches/eval**, so icons
must be bundled at build time — this rules out the default behaviour of
`@iconify/svelte` and the `iconify-icon` web component, both of which **fetch from
the Iconify API at runtime** unless manually preloaded (verified via agy research).

| Option | CSP-safe (offline) | Tree-shaking | Svelte 5 DX | Catalog | Verdict |
|---|---|---|---|---|---|
| **`unplugin-icons` + `@iconify/json`** | ✅ build-time SVG | ✅ | ✅ `import Play from '~icons/mdi/play'` | **all Iconify sets** (200k+) | **recommended** |
| `lucide-svelte` | ✅ | ✅ | ✅ best, zero-config | Lucide set only | great if one set suffices |
| `@iconify/svelte` (runtime) | ❌ fetches API by default | ✗ | ok | all | reject for MV3 |
| `iconify-icon` web component | ❌ fetches API by default | ✗ | ok | all | reject for MV3 |
| hand-built SVG sprite | ✅ | ✅ | ✗ high friction | manual | only if avoiding deps |

**Recommendation: `unplugin-icons` + `@iconify/json`.** It directly uses the
Iconify catalog (https://icon-sets.iconify.design/), compiles to inline SVG at
build time (CSP-safe, no runtime/eval), tree-shakes to only the icons imported,
and composes with the existing Vite + crxjs setup. Pick `lucide-svelte` instead
only if a single cohesive icon set is acceptable and minimal config is preferred.

Setup:
```bash
npm i -D unplugin-icons @iconify/json
```
```ts
// vite.config.ts
import Icons from "unplugin-icons/vite";
// plugins: [svelte(), Icons({ compiler: "svelte" }), crx({ manifest })]
```
```svelte
<script lang="ts">
  import Play from "~icons/mdi/play";
  import Seed from "~icons/mdi/sprout";
  import Pause from "~icons/mdi/pause";
  // map task.status → component, render <Play /> etc. in the progress-icon slot
</script>
```
Add `"~icons/*"` typing via `unplugin-icons/types/svelte` in `env.d.ts`. Licensing:
per-set (mdi = Apache-2.0, lucide = ISC) — both permissive.

## 10. Rollback
Every phase is a self-contained, shippable commit. Rollback = revert to the last
phase boundary; the extension remains functional because vanilla and Svelte
components coexist until Phase 4.
