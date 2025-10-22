# Toolbar Action Buttons Overview

This note captures the current behaviour of the popup toolbar buttons (`.toolbar-actions` block) and highlights mismatches or issues that need follow-up.

## Elements

| Button | DOM id | Visible glyph | Tooltip / aria-label | Current behaviour | Notes |
| --- | --- | --- | --- | --- | --- |
| Settings | `toolbar-settings` | `⚙` | “Toggle settings” | Toggles the visibility of the settings panel and updates `aria-expanded/pressed`. | Works as expected. |
| Play | `toolbar-play` | `▶` | “Refresh downloads” / “Refresh downloads” | Calls `startTorrent(selectedHash)` for the currently highlighted task. Requires a selected download. | **Issue:** Tooltip/aria-label say “Refresh downloads”, but real action starts the torrent. Needs copy update. |
| Stop | `toolbar-stop` | `■` | “Stop auto-refresh” / “Stop auto-refresh” | Calls `stopTorrent(selectedHash)` for the selected task. Requires selection. | **Issue:** Tooltip/aria-label reference auto-refresh, but action stops the torrent. Update wording. |
| Pause | `toolbar-pause` | `⏸` | “Pause auto-refresh” / “Pause auto-refresh” | No click handler is wired up, so pressing the button does nothing. | **Bug:** Implement handler or remove the control. |
| Add | `toolbar-add` | `＋` | “Add torrent” | Opens the hidden file input so the user can pick a `.torrent`. | Works as expected. |
| Remove | `toolbar-remove` | `−` | “Remove selected download” | Calls `removeDownload(selectedHash)` and clears the current selection. Requires selection. | Behaviour matches label. |

## Selection-dependent actions

Buttons `toolbar-play`, `toolbar-stop`, and `toolbar-remove` log to the console (and the optional debug log feed) whenever they are pressed, including whether a selection was present. If no task is highlighted the UI shows user-facing guidance and the handler exits.

## Recommendations

1. Align the `title`/`aria-label` text for the Play/Stop buttons with their real effect (start/stop torrent rather than auto-refresh).
2. Either wire up `toolbar-pause` to real functionality (pause torrent or pause auto-refresh) or remove it from the markup to avoid confusing users.
