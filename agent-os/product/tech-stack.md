# Tech Stack

Derived from `package.json`, `vite.config.ts`, and `.github/workflows/ci.yml`.

## Runtime

- **Chrome extension, Manifest V3** — service worker background, `minimum_chrome_version: 120`.
- **Firefox** via a separate `manifest.firefox.json` and `BROWSER_TARGET=firefox` build
  (`strict_min_version: 121`). Download interception is Chromium-only.
- **Node 20** in CI.

## Language & UI

- **TypeScript**, `strict: true`. `type` over `interface` in new code; no `any`.
- **Svelte 5, runes only** (`$state` / `$derived` / `$props` / `$effect`).
  See `agent-os/standards/frontend/svelte-runes-only.md`.
- **UnoCSS + presetWind4** for popup UI utilities. Existing CSS custom properties in `tokens.css` remain the source of truth for semantic theme colors. Statically extractable classes only; no Attributify, no runtime shortcuts.
  See `agent-os/standards/frontend/unocss-llm-first.md`.
- **Storybook 10** for component development.
- Icons via `unplugin-icons` + `@iconify-json/lucide`.

## Build

- **Vite 8** with `@crxjs/vite-plugin` for MV3 packaging.
- Output: `dist/` (Chromium), `dist-firefox/` (Firefox, packaged by `web-ext`).

## Quality gates

- **Biome 2** — lint and format (replaces ESLint + Prettier). `noConsole` is enforced in
  popup/UI code; background `console.*` is exempt by config.
- **Vitest 4** + jsdom — unit tests, with a hand-written `chrome.*` mock in
  `tests/mocks/chrome.ts` and MSW for HTTP.
- **Playwright 1.61** — E2E against a mock NAS (`tests/e2e/support/mockNas.ts`), and an
  opt-in suite against a real NAS behind `QNAP_E2E_REAL=1`.
- **svelte-check** for Svelte/TS diagnostics.

CI and the pre-push hook gate on: `typecheck → unit tests → build → mock E2E`.

## API

- **QNAP Download Station V4** REST, spoken through `openapi-fetch` in `src/api/client.ts`.
  Responses are untyped and parsed only at that DTO boundary.
  See `agent-os/standards/api/qnap-download-station-contract.md`.

## Release

- `env/dev` is the working branch; releases go out through a PR to `env/prod`, which is the
  only branch allowed to publish. Chrome Web Store upload is automated in
  `.github/workflows/deploy.yml` via `chrome-webstore-upload`; Firefox is packaged with
  `web-ext` (see `docs/firefox-release-guide.md`).
