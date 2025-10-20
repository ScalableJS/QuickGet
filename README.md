# QNAP Download Station 5 Remote Client

QuickGet Remote is a browser extension that provides a focused interface for QNAP Download Station 5. It streamlines remote task management by exposing the most common actions directly in the browser.

## Capabilities

- Send links, magnet URIs, or torrent files to Download Station with a single action.
- Monitor active tasks, review seeding items, and remove entries when necessary.
- Validate NAS settings directly from the popup and persist them locally.
- Operate on Chromium-based browsers and Firefox without additional plugins.

## Installation

### Chrome / Edge / Chromium
1. Download the current release build.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable *Developer mode*.
4. Select *Load unpacked* and choose the `dist` directory.

### Firefox
1. Open `about:debugging#/runtime/this-firefox`.
2. Select *Load Temporary Add-on...*.
3. Choose `dist/manifest.json`.

## Configuration

1. Open the QuickGet Remote popup.
2. Specify NAS connection parameters:
   - NAS address (IP or hostname)
   - Port number
   - Username and password
   - HTTPS toggle, temporary directory, and destination directory (optional)
3. Run *Test Connection* to confirm credentials.
4. Use the downloads tab to review current tasks or add torrents.

All configuration values are stored in `chrome.storage.local` and remain on the local browser profile. No data is transmitted to external services.

## Development

### Prerequisites
- Node.js 18 or newer
- npm (bundled with Node.js) or yarn

### Setup

```bash
git clone <repo-url>
cd QuickGet-Remote
npm install
```

### Key Scripts

```bash
npm run dev        # Start Vite in watch mode
npm run build      # Create production bundle
npm run typecheck  # Run TypeScript without emitting files
npm run lint       # Execute ESLint checks
npm run lint:fix   # Auto-fix lint warnings
npm run format     # Format with Prettier
```

## Project Layout

```
QuickGet-Remote/
├── src/
│   ├── background/   // Service worker modules
│   ├── lib/          // QNAP API helpers and settings
│   ├── popup/        // Popup UI logic and rendering
│   └── ui/           // Shared UI utilities
├── dist/             // Build output (generated)
├── icons/            // Extension icons and sources
├── scripts/          // Build helpers
└── manifest.json     // Chrome/Firefox manifest v3
```

## Documentation

- [INDEX.md](./INDEX.md) — master index for all documentation.
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) — API usage details.
- [MIGRATION.md](./MIGRATION.md) — v2.8 to v2.9 changes.
- [NEW_README.md](./NEW_README.md) — extended onboarding notes.
- [COMPLETE_SUMMARY.md](./COMPLETE_SUMMARY.md) — historical summary.

## Security and Data Handling

- Credentials and NAS settings are stored locally in `chrome.storage.local`.
- HTTPS connections are supported when the NAS is configured with TLS.
- The extension requests only the permissions required for context menus, storage, alarms, and notifications.
- No analytics, telemetry, or third-party network calls are embedded in the build.

## Troubleshooting Checklist

**Extension fails to load**
- Verify browser version (Chrome/Edge ≥ 120, Firefox ≥ 121).
- Confirm the extension was loaded from the `dist` directory.

**Connection errors**
- Re-check NAS address and port.
- Validate that Download Station is enabled on the NAS.
- Use *Test Connection* after saving credentials.

**Need more detail**
- Refer to [DEBUG_INSTRUCTIONS.md](./DEBUG_INSTRUCTIONS.md) for log collection steps.

## Browser Compatibility

| Browser | Minimum version | Notes            |
|---------|-----------------|------------------|
| Chrome  | 120             | Manifest V3 build |
| Edge    | 120             | Same as Chrome    |
| Firefox | 121             | Temporary add-on loading |

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/<name>`.
3. Run `npm run build && npm run lint` before submitting changes.
4. Open a pull request with a concise description of the change.

Pull requests are preferred to long-lived forks so improvements remain consolidated.

## License

QuickGet Remote is distributed under the **Creative Commons Attribution–NonCommercial–ShareAlike 4.0 International (CC BY-NC-SA 4.0)** license.  
- Non-commercial use only.  
- Derivative work must use the same license.  
- Provide attribution with a link to this repository and the license text.  

Full text: <https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode>

---

Version 2.9.0 (October 2025)  
Status: Production ready  
License: CC BY-NC-SA 4.0
