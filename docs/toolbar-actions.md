---
type: reference
status: active
area: popup
updated: 2026-10-09
---

# Popup toolbar actions

The current toolbar mounts `Toolbar.svelte` with actions from the toolbar initializer.
Task controls are disabled without a selected task; the initializer also checks selection
before invoking a mutation.

| Control | Current behavior |
|---|---|
| Start download | Calls the selected task's Start API and requests monitoring |
| Stop download | Calls Stop for the selected task |
| Pause download | Calls Pause; explicit unsupported API falls back to Stop |
| Add torrent | Opens the local `.torrent` file picker |
| Add URLs | Opens the batch URL panel through the Add split menu |
| Remove download | Removes the selected NAS task |
| Remove with files | Confirms irreversible NAS file removal before clean deletion |
| Settings / Back to downloads | Toggles the settings panel and refreshes on return |

The header transfer rates are derived from the current popup task snapshot. These controls
are distinct from the browser action icon/badge, whose sole writer is the background.

[Task management](system/task-management.md), [popup upload](system/popup-upload.md), and
[background monitoring](system/monitoring.md) own the full behavior and limitations.

The earlier analysis describing dead Pause controls and auto-refresh tooltips was superseded
by the Svelte toolbar and current action bindings; it is not the current UI contract.
