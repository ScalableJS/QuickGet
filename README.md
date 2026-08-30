# QNAP Download Station 5 Remote Client

QuickGet Remote is a browser extension that provides a focused interface for QNAP Download Station 5. It streamlines remote task management by exposing the most common actions directly in the browser.

## Capabilities

- Send links, magnet URIs, or torrent files to Download Station with a single action.
- Intercept browser `.torrent` downloads and route them to the NAS. This is enabled by default and can be turned off in Settings. The normal hand-off pauses the browser download, cancels it only after the NAS accepts it, and resumes it if sending fails. Chromium also offers an opt-in strict mode that avoids the browser's save prompt and local copy.
- Monitor active tasks, review seeding items (upload volume and share ratio), and remove entries when necessary.
- Pick which files inside a multi-file torrent the NAS should download.
- Route tasks to different NAS folders automatically with rules matched on URL, domain, or task name.
- Optionally lock the settings screen behind a password so the NAS connection cannot be read or changed at a shared computer.
- Validate NAS settings directly from the popup and persist them locally.
- Operate on Chromium-based browsers and Firefox without additional plugins.

## Installation

### Chrome / Edge / Chromium
Install the published build from the [Chrome Web Store](https://chromewebstore.google.com/detail/hdeipkdkjejfhbdmcejlgdccpocfbbcm).

To load a local build instead:
1. Run `npm run build`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable *Developer mode*.
4. Select *Load unpacked* and choose the `dist` directory.

### Firefox
1. Open `about:debugging#/runtime/this-firefox`.
2. Select *Load Temporary Add-on...*.
3. Choose `dist-firefox/manifest.json` (built by `npm run build:firefox`).

## Configuration

1. Open the QuickGet Remote popup.
2. Click the ⚙ button to open Settings and specify NAS connection parameters:
   - NAS address (IP or hostname)
   - Port number
   - Username and password
   - Server URL (`http://` or `https://`), temporary directory, and destination directory
   - Torrent interception
   - Optional routing rules that send matching tasks to a folder of their own
   - Color theme (*Auto* / *Light* / *Dark*, default: *Auto*, which follows the OS)
3. Run *Test Connection* to confirm credentials, then *Save Settings*.
4. Close Settings to return to the downloads list; add torrents or manage existing tasks from the toolbar.

### Checkbox defaults

| Setting | Default | Meaning |
| --- | --- | --- |
| **Send .torrent downloads to the NAS** | On | The normal, safe hand-off. If the NAS cannot accept the torrent, Chrome resumes the browser download. |
| **Don't keep the .torrent file locally** | Off (Chromium only) | Avoids a "Save as" prompt and a local copy. If the NAS cannot accept it, click the link again. It becomes available after torrent forwarding is on. |
| **Protect settings** | Off | A password is opt-in because it protects only access to the settings screen; background downloads continue either way. |

All configuration values are stored in `chrome.storage.local` and remain on the local browser profile. The extension sends connection credentials, torrent URLs, magnet links, and selected `.torrent` files only to the NAS address configured by the user; it does not use analytics, telemetry, or third-party services. See the [privacy policy](./docs/privacy-policy.md).

## Development

### Prerequisites
- Node.js 20.19+ or 22.12+ (required by Vite 8; CI builds on Node 20)
- npm (bundled with Node.js)

### Setup

```bash
git clone <repo-url>
cd SendToQNAP
npm install
```

### Key Scripts

```bash
npm run dev              # Start Vite in watch mode
npm run build            # Create Chromium production bundle
npm run build:firefox    # Create Firefox production bundle in dist-firefox/
npm run package:firefox  # Create unsigned AMO upload package
npm run typecheck        # Run TypeScript without emitting files
npm run test             # Run unit/integration tests with Vitest
npm run test:e2e:mock    # Run safe mock-only Playwright E2E tests
npm run test:e2e:real    # Run read-only E2E against a real NAS (see tests/README.md)
npm run test:coverage    # Unit tests with coverage
npm run lint             # Lint with Biome
npm run lint:fix         # Auto-fix lint issues with Biome
npm run check:svelte     # Type-check .svelte files with svelte-check
npm run format           # Format with Biome
npm run check            # Biome lint + format check in one pass
npm run package:chrome   # Zip the Chromium build for the Web Store
npm run generate-icons   # Generate icon set from sources
npm run storybook        # Start Storybook for component development
npm run build-storybook  # Build static Storybook
```

## Project Layout

```
SendToQNAP/
├── src/
│   ├── api/              // OpenAPI-based QNAP API client
│   ├── background/       // Service worker (alarms, menus, actions, download interception)
│   ├── lib/              // Core utilities (config, logger, settings, settingsLock,
│   │                     //   routingRules, tasks, torrentSender)
│   └── popup/            // UI entry point (Svelte 5); also serves as the options page
│       ├── components/   // Reusable UI components (downloadItem, statusPill, icons)
│       ├── features/     // downloads, settings, toolbar, upload, folderPicker,
│       │                 //   torrentFiles, unlock
│       ├── shared/       // Shared popup utilities (API cache, monitor)
│       ├── styles/       // Design tokens and global styles
│       └── ui/           // Presentational primitives (Tabs, FormSection, SearchField)
├── tests/                // Vitest mocks and Playwright E2E suites
├── agent-os/             // Product context, standards, and the bug board
├── dist/                 // Chromium build output (generated by Vite)
├── icons/                // Extension icons and sources
├── public/               // Assets copied verbatim into the build
├── scripts/              // Build helpers (icons, store assets, Web Store upload)
├── store-assets/         // Chrome Web Store listing artwork
├── _locales/             // Internationalization files
├── docs/                 // Project documentation
└── manifest.json         // Chrome/Firefox manifest v3
```

## Documentation

Additional documentation is available in the `docs/` directory:
- [svelte-migration-plan.md](./docs/svelte-migration-plan.md) — Svelte 5 migration plan, phases, and icon strategy
- [popup-refactoring-plan.md](./docs/popup-refactoring-plan.md) — Popup architecture and refactoring notes
- [toolbar-actions.md](./docs/toolbar-actions.md) — Toolbar implementation details
- [cache-options.md](./docs/cache-options.md) — API client caching options
- [settings-ux-plan.md](./docs/settings-ux-plan.md) — Settings screen UX plan
- [download-interception-bugs.md](./docs/download-interception-bugs.md) — Known interception edge cases
- [local-development.md](./docs/local-development.md) — Local development setup
- [firefox-release-guide.md](./docs/firefox-release-guide.md) — AMO packaging and submission
- [feature-roadmap.md](./docs/feature-roadmap.md) — Planned work
- [competitor-analysis.md](./docs/competitor-analysis.md) and [synology-download-station-analysis.md](./docs/synology-download-station-analysis.md) — Prior-art research

Contributor-facing conventions, standards, and the open-defect board live in
[AGENTS.md](./AGENTS.md) and `agent-os/`.

For the complete testing map, runbook, and capture refresh workflow, see [`tests/README.md`](./tests/README.md).

## Security and Data Handling

- Credentials and NAS settings are stored locally in `chrome.storage.local`.
- HTTPS connections are supported when the NAS is configured with TLS.
- The extension requests only the permissions it needs: `contextMenus`, `storage`, `alarms`, `notifications`, `downloads` (torrent interception), and `scripting` (re-fetching a `.torrent` in the page's own session). Broad host permissions are required because the NAS address is user-supplied and torrents may be hosted anywhere.
- The optional settings password locks the UI only; it is not encryption. Only a salt and a PBKDF2 verifier are stored, never the password itself, and the unlocked flag lives in `chrome.storage.session`. The service worker must reach the NAS while nobody is at the keyboard, so the stored credentials cannot be encrypted behind a user-held key — see `src/lib/settingsLock.ts`.
- No analytics, telemetry, or third-party network calls are embedded in the build.
- Firefox listing disclosure: connection credentials and torrent data are sent only to the user-configured NAS. See the [privacy policy](./docs/privacy-policy.md).

## Troubleshooting Checklist

**Extension fails to load**
- Verify browser version (Chrome/Edge ≥ 120, Firefox ≥ 121).
- Confirm the extension was loaded from the `dist` directory.

**Connection errors**
- Re-check NAS address and port.
- Validate that Download Station is enabled on the NAS.
- Use *Test Connection* after saving credentials.

**Need more detail**
- Enable debug mode in the extension settings to see detailed logs in the browser console.

## Browser Compatibility

| Browser | Minimum version | Notes            |
|---------|-----------------|------------------|
| Chrome  | 120             | Manifest V3 build |
| Edge    | 120             | Same as Chrome    |
| Firefox | 121             | AMO-compatible Manifest V3 build |

## Architecture

### API Client
The extension uses `openapi-fetch` against a hand-maintained schema in `src/api/schema.d.ts`, structured like `openapi-typescript` output so the request and response types stay checked. QNAP publishes no OpenAPI document, so the schema is written by hand from observed Download Station V4 behaviour; the client lives in `src/api/`.

### UI Components
- **Svelte 5** (runes: `$state`, `$derived`, `$effect`) renders the popup, settings, toolbar, and folder picker; Svelte roots are mounted by thin imperative glue.
- **Feature modules** organize functionality (downloads, settings, toolbar, upload, folderPicker, torrentFiles, unlock)
- **UnoCSS** (`uno.config.ts`) for atomic styling, with design tokens in `src/popup/styles/`
- **lucide icons** inlined at build time (CSP-safe, no runtime fetch)
- **Storybook** (svelte-vite) for component development, including an icon set and control-state gallery

### State Management
- Chrome storage API for persistence (`chrome.storage.local`)
- Reactive `$state` view stores (`downloadsView`, `toolbarView`) read by components and mutated by the feature glue
- Client-side caching for API responses

## Contributing

1. Fork the repository and branch from `env/dev`.
2. Create a feature branch: `git checkout -b feature/<name>`.
3. Use conventional-commit messages (`feat(settings): …`, `fix(background): …`).
4. Run the same gate CI and the pre-push hook enforce, before submitting changes:

   ```bash
   npm run typecheck && npm run check:svelte && npm run lint && npm test && npm run build && npm run test:e2e:mock
   ```
5. Open a pull request against `env/dev` with a concise description of the change.

`env/prod` is release-only — it is the sole branch that publishes to the Chrome Web Store.

Pull requests are preferred to long-lived forks so improvements remain consolidated.

## License

QuickGet Remote is distributed under the MIT License. See [LICENSE.md](./LICENSE.md).
