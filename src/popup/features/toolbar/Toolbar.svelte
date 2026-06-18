<script lang="ts">
  import { toolbarView } from "./toolbarView.svelte.js";

  interface ToolbarActions {
    start: () => void;
    stop: () => void;
    pause: () => void;
    remove: () => void;
    add: () => void;
    toggleSettings: () => void;
  }

  let { actions }: { actions: ToolbarActions } = $props();

  const disabled = $derived(!toolbarView.hasSelection);
</script>

<div class="toolbar-left">
  <button
    type="button"
    id="toolbar-settings"
    class="toolbar-btn"
    title="Toggle settings"
    aria-label="Toggle settings"
    aria-controls="settings-panel"
    aria-expanded={toolbarView.settingsExpanded}
    aria-pressed={toolbarView.settingsExpanded}
    onclick={actions.toggleSettings}
  >
    ⚙
  </button>
  <span id="status-speed" class="status-speed" aria-live="off">{toolbarView.statusSpeed}</span>
</div>
<div class="toolbar-actions">
  <button
    type="button"
    id="toolbar-play"
    class="toolbar-btn"
    title="Refresh downloads"
    aria-label="Refresh downloads"
    {disabled}
    aria-disabled={disabled}
    onclick={actions.start}
  >
    ▶
  </button>
  <button
    type="button"
    id="toolbar-stop"
    class="toolbar-btn"
    title="Stop auto-refresh"
    aria-label="Stop auto-refresh"
    {disabled}
    aria-disabled={disabled}
    onclick={actions.stop}
  >
    ■
  </button>
  <button
    type="button"
    id="toolbar-pause"
    class="toolbar-btn"
    title="Pause auto-refresh"
    aria-label="Pause auto-refresh"
    {disabled}
    aria-disabled={disabled}
    onclick={actions.pause}
  >
    ⏸
  </button>
  <button type="button" id="toolbar-add" class="toolbar-btn" title="Add torrent" aria-label="Add torrent" onclick={actions.add}>
    ＋
  </button>
  <button
    type="button"
    id="toolbar-remove"
    class="toolbar-btn"
    title="Remove selected download"
    aria-label="Remove selected download"
    {disabled}
    aria-disabled={disabled}
    onclick={actions.remove}
  >
    −
  </button>
</div>
