# Popup Architecture

This document describes the target organization of the popup extension code — what modules are needed, how they interact, and where shared dependencies live. This is not a "work plan" but a reference to align with during refactoring.

## Goals and principles

- separate concerns: UI components, feature business logic, and shared utilities;
- remove global variables from `src/popup/index.ts`;
- reuse already existing modules (`@lib/settings`, `@api/client`, the `components/downloadItem` render);
- preserve current behavior (including hotkeys, auto-refresh, log copying), but make it transparent and testable;
- provide a unified coordination layer between features (e.g. selecting a download should update the toolbar and status).

### Layers

- **Components** — pure functions/classes responsible only for rendering. They know nothing about API, state, or side effects.
- **Features** — concentrate business logic, work with state, API, DOM events, and orchestrate components.
- **Shared** — common utilities callable from any layer (formatting, morphdom wrappers, API cache).

## Directory structure

```
src/popup/
├── index.ts                       # entry point, coordinates features
├── index.html
├── index.css
│
├── components/
│   ├── downloadItem/
│   │   ├── downloadItem.ts        # ready-made download item render
│   │   ├── downloadItem.stories.ts
│   │   └── index.ts
│   ├── statusPill/
│   │   ├── statusPill.ts          # status render and API
│   │   └── index.ts
│   └── index.ts                   # single export point for UI components
│
├── features/
│   ├── downloads/
│   │   ├── downloadsManager.ts    # Download Station API interaction
│   │   ├── downloadsState.ts      # selectedHash, snapshot, observable events
│   │   ├── downloadsUI.ts         # attaching handlers, morphdom updates
│   │   ├── autoRefresh.ts         # auto-refresh and toolbar sync
│   │   └── index.ts
│   ├── settings/
│   │   ├── settingsUI.ts           # settings form DOM logic
│   │   ├── connectionTest.ts       # connection test button
│   │   └── index.ts
│   ├── toolbar/
│   │   ├── toolbarActions.ts       # start/stop/remove/add/settings toggle
│   │   ├── toolbarState.ts         # enable/disable buttons, subscribe to download state
│   │   └── index.ts
│   ├── upload/
│   │   ├── torrentUpload.ts        # single handling point for `<input type=file>`
│   │   ├── duplicateCheck.ts       # reads snapshot from downloadsState
│   │   └── index.ts
│   ├── debug/
│   │   ├── debugLogger.ts          # add/clear/copy logs
│   │   ├── debugUI.ts              # panel display and enableDebug subscription
│   │   └── index.ts
│   └── index.ts                    # public init methods of features
│
├── shared/
│   ├── formatters/
│   │   ├── speed.ts                # speed formatting
│   │   ├── time.ts                 # ETA formatting (reserved)
│   │   └── date.ts                 # date formatting (reserved)
│   ├── dom/
│   │   ├── morphdom.ts             # wrappers over morphDOMUpdate/List
│   │   └── index.ts
│   └── api/
│       ├── clientCache.ts          # createApiClient cache
│       └── index.ts
│
└── types/
    └── popup.types.ts              # local types not present in @lib (if actually needed)
```

> If an additional type is already described in `src/lib`, use the import from there. A new file in `types/` is justified only when the type domain-belongs exclusively to the popup.

## Feature details

### Downloads

- `downloadsManager` uses `createApiClient` from `@api/client` and the cache from `shared/api/clientCache`. Responsible for `list`, `start`, `stop`, `remove`.
- `downloadsState` holds `selectedHash`, `snapshot` (hashes + normalized names), publishes events (`onSelectionChanged`, `onSnapshotUpdated`). The global variables from the current `index.ts` move here.
- `downloadsUI` integrates `renderDownloadsList` from `components/downloadItem` (the existing `render/downloads.ts` is moved here and re-exported), manages `morphDOM` and list clicks. On list update, it queries `downloadsState` and signals the toolbar.
- `autoRefresh` regulates the refresh interval, listens to the `toolbar` (Play/Stop/Pause buttons), and reports status (e.g. for changing the button label).

Top-level API: `initializeDownloads(options)` returns an object with the methods `refreshNow`, `getSelectedHash`, `subscribe`.

### Settings

- Saves/reads data via `@lib/settings`. Local logic is only form collection/validation.
- `settingsUI` handles showing the panel, syncing checkboxes, disabling the downloads list while settings are open.
- `connectionTest` uses `createApiClient` directly (without cache) and publishes the result via `components/statusPill`.

### Toolbar

- `toolbarActions` implements current behavior: `Play/Stop` work with the selected torrent, `Remove` deletes via downloadsManager, `Add` opens `<input>`, `Settings` toggles the panel. `Pause` (if needed) controls auto-refresh, but the actual presence of the button is verified against the HTML.
- Tooltips/aria attributes in `index.html` must match this logic (some markup rewording may be required, if needed).
- `toolbarState` subscribes to `downloadsState` and auto-refresh, enables/disables buttons, sets `aria-disabled`.

### Upload

- `torrentUpload` handles the `change` event on `<input>`. Calls `duplicateCheck`, which reads the snapshot from `downloadsState`. On success, it calls `downloadsManager.refresh` once the addition completes (via the export from the downloads feature, without a direct `listDownloads` import).

### Debug

- `debugLogger` holds an array of strings and public `add`, `clear`, `copy` methods. The `enabled` state comes from settings or a UI toggle.
- `debugUI` handles the `details.debug-section` DOM nodes, updates content, and listens to the `enableDebug` checkbox. Status changes go through `downloadsState` and `components/statusPill` (for "Logs copied", "Logs cleared" messages).

## Components

- `downloadItem` — remains a pure component (already implemented). Called via `renderDownloadsList` inside downloadsUI.
- `statusPill` — new component, encapsulates work with `#status`/`#status-message` and the auto-hide timer. Exports `showStatus(type)` and `clearStatus()`.

Other UI elements (icons, buttons) remain in the markup for now; complex blocks are moved to `components/` as they appear.

## Shared utilities

- `formatters/speed.ts` contains the current `formatRate`. Add new files for time/date formatting as needed, but use the same functions everywhere (download item, status, tools).
- `dom/morphdom.ts` provides the `updateElement(target, html, options?)` and `updateList(target, html)` wrappers. After the move, update aliases in `tsconfig.json` / `vite.config.ts` so `@popup/update/dom` points to the new location.
- `api/clientCache.ts` holds `clientCache` (formerly a global variable). Exports `getCachedClient()` and `invalidateClientCache()` — call them from settings (after saving) and downloads.

## Coordination in `index.ts`

The entry point sets up the DOM and wires the features together:

```ts
import { initializeDownloads } from "./features/downloads";
import { initializeSettings } from "./features/settings";
import { initializeToolbar } from "./features/toolbar";
import { initializeUpload } from "./features/upload";
import { initializeDebug } from "./features/debug";

document.addEventListener("DOMContentLoaded", async () => {
  const downloads = await initializeDownloads();
  const settings = await initializeSettings({ onDebugToggle: initializeDebug });
  const debug = await initializeDebug();
  const upload = await initializeUpload({ downloads });
  await initializeToolbar({ downloads, settings, upload, debug });
});
```

Each `initialize*` returns an object with public methods (e.g. `downloads.refreshNow`, `toolbar.disableAutoRefresh`). This removes direct imports between features and makes the connections explicit.

## Implementation recommendations

- **HTML and ARIA**: align toolbar button labels and `aria-label`s with the actual logic (start/stop torrent, toggle settings, etc.).
- **Storybook**: after moving components, update the stories (`downloadItem`) and add new ones for `statusPill`.
- **Events**: centrally propagate notifications (selection change, snapshot change, autoRefresh state) via `downloadsState`, so the toolbar and upload subscribe instead of reading the DOM.
- **Behavior verification**: preserve auto-refresh, resource cleanup on `beforeunload`, log copying, and duplicate check behavior — all these scenarios must be covered in the new modules.
- **Types**: before creating separate interfaces, verify there is no equivalent in `src/lib`. Add a new `types/popup.types.ts` only for UI-specific types.

## Expected outcome

- `src/popup/index.ts` — ~80 lines, only initialization and dependency wiring.
- Other files — small and topical (30–100 lines).
- Any feature can be tested in isolation (mock API, mock DOM).
- Adding new actions or UI elements doesn't require changing a huge monolithic file.
