<script lang="ts">
  import IconSettings from "~icons/lucide/settings";
  import IconPlay from "~icons/lucide/play";
  import IconStop from "~icons/lucide/circle-stop";
  import IconPause from "~icons/lucide/pause";
  import IconPlus from "~icons/lucide/plus";
  import IconTrash from "~icons/lucide/trash-2";

  import { toolbarView } from "./toolbarView.svelte.js";

  type ToolbarActions = {
    start: () => void;
    stop: () => void;
    pause: () => void;
    remove: () => void;
    add: () => void;
    toggleSettings: () => void;
  };

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
    <IconSettings />
  </button>
  <span id="status-speed" class="status-speed" aria-live="off">{toolbarView.statusSpeed}</span>
</div>
<div class="toolbar-actions">
  <button
    type="button"
    id="toolbar-play"
    class="toolbar-btn"
    title="Start selected download"
    aria-label="Start selected download"
    {disabled}
    aria-disabled={disabled}
    onclick={actions.start}
  >
    <IconPlay />
  </button>
  <button
    type="button"
    id="toolbar-stop"
    class="toolbar-btn"
    title="Stop selected download"
    aria-label="Stop selected download"
    {disabled}
    aria-disabled={disabled}
    onclick={actions.stop}
  >
    <IconStop />
  </button>
  <button
    type="button"
    id="toolbar-pause"
    class="toolbar-btn"
    title="Pause selected download"
    aria-label="Pause selected download"
    {disabled}
    aria-disabled={disabled}
    onclick={actions.pause}
  >
    <IconPause />
  </button>
  <button type="button" id="toolbar-add" class="toolbar-btn" title="Add torrent" aria-label="Add torrent" onclick={actions.add}>
    <IconPlus />
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
    <IconTrash />
  </button>
</div>
