---
type: reference
status: active
area: engineering
updated: 2026-10-10
features: ["build-release"]
---

# Builds, releases, and project tooling

## Artifacts

| Artifact | Command | Consumer |
|---|---|---|
| `dist-dev` | `npm run build:dev` | Unpacked development and mock E2E |
| `dist` | `npm run build` | Production package, real-NAS spot check, store assets and demo |
| `dist-firefox` | `npm run build:firefox` | Firefox packaging and web-ext validation |
| Storybook site | `npm run build-storybook` | Component development |

The manifests select browser-specific background configuration. Chromium declares Chrome 120 as its minimum; Firefox declares 142.0. Shared content-script magnet/file handling and download listener setup exist in code, while Chromium-specific deferred filename support is optional. Mock CI exercises Chromium. Firefox packaging/lint does not prove runtime parity or a guaranteed no-local-file outcome on Firefox.

## Quality and release

CI runs typecheck, Svelte check, lint, unit/deployment tests, builds, and mock E2E. The local pre-push hook runs typecheck. Documentation and language checks are additional maintained gates. Real-NAS production spot checks remain local because Actions has no route to the home NAS.

`env/dev` is the direct working branch. Production promotion uses a reviewed PR into `env/prod`; only that branch triggers Web Store publication. The deployment script implements the Store API directly. The unused direct `chrome-webstore-upload` dependency was removed; the hand-written uploader remains the implementation. Firefox packages are built with web-ext and documented separately.

## Tooling ownership

Agent OS owns mission/roadmap/stack and engineering standards. Task frontmatter owns work state; Obsidian Bases are views. Rulesync sources under `.rulesync` own project rules, commands, and skill wrappers; generation must be checked. Source comments, descriptions, and maintained prose are English, with non-Latin data retained in deliberate Unicode tests.

The manual test stand is launched with `npm run stand` using the declared development dependency `tsx`; [BUG-66](../../tasks/BUG-66.md) records its accepted startup/shutdown verification. E2E imports the Hono stand through its own harness and passing fixture tests do not make the manual command available.

## Sources and evidence

- [package.json](../../package.json), [Vite configuration](../../vite.config.ts), [CI](../../.github/workflows/ci.yml), [deploy workflow](../../.github/workflows/deploy.yml), [Store uploader](../../scripts/upload-webstore.js).
- [Local development](../local-development.md), [Firefox release](../firefox-release-guide.md), [Web Store guide](../../CHROMEWEBSTORE.md).
- Build/lint/unit/mock checks are reproducible commands; deployment tests exercise the uploader without publishing. No release is authorized by documentation work.


## Manual stand

npm run stand uses the declared tsx development dependency rather than relying on a global executable. It starts the existing local stand and mock NAS and shuts both down on Ctrl+C. This change does not establish real-NAS behavior or alter the stand's port policy.

## Retained-tab content-script build

The CRX contentScripts.standaloneFiles option builds src/content/magnet.ts as an IIFE. The current runtime context must be recreated on extension reload; an old dynamically imported module can retain an invalidated context. The background session-lifetime refresh and DOM-first cleanup complement this build choice. The Chromium regression performs an actual extension reload while keeping the site open; see [[page-capture]]. This is not Firefox runtime certification.
