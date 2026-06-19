<script lang="ts">
  import IconSettings from "~icons/lucide/settings";
  import IconPlay from "~icons/lucide/play";
  import IconStop from "~icons/lucide/circle-stop";
  import IconPause from "~icons/lucide/pause";
  import IconPlus from "~icons/lucide/plus";
  import IconChevronDown from "~icons/lucide/chevron-down";
  import IconFile from "~icons/lucide/file";
  import IconLink from "~icons/lucide/link";
  import IconTrash from "~icons/lucide/trash-2";

  import { toolbarView } from "./toolbarView.svelte.js";

  type ToolbarActions = {
    start: () => void;
    stop: () => void;
    pause: () => void;
    remove: () => void;
    add: () => void;
    addUrls: () => void;
    toggleSettings: () => void;
  };

  let { actions }: { actions: ToolbarActions } = $props();

  const disabled = $derived(!toolbarView.hasSelection);

  let addMenuOpen = $state(false);

  function pick(action: () => void): void {
    addMenuOpen = false;
    action();
  }
</script>

<svelte:window onclick={() => (addMenuOpen = false)} onkeydown={(e) => e.key === "Escape" && (addMenuOpen = false)} />

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
  <!-- Split button: primary click keeps the legacy .torrent flow; caret opens more add options. -->
  <div class="split-btn" role="group" aria-label="Add download">
    <button type="button" id="toolbar-add" class="toolbar-btn split-primary" title="Add torrent" aria-label="Add torrent" onclick={actions.add}>
      <IconPlus />
    </button>
    <button
      type="button"
      id="toolbar-add-menu"
      class="toolbar-btn split-caret"
      title="More add options"
      aria-label="More add options"
      aria-haspopup="menu"
      aria-expanded={addMenuOpen}
      onclick={(e) => {
        e.stopPropagation();
        addMenuOpen = !addMenuOpen;
      }}
    >
      <IconChevronDown />
    </button>
    {#if addMenuOpen}
      <div class="add-menu" role="menu" tabindex="-1">
        <button type="button" role="menuitem" class="menu-item" onclick={() => pick(actions.add)}>
          <IconFile /> Add .torrent file
        </button>
        <button type="button" role="menuitem" class="menu-item" onclick={() => pick(actions.addUrls)}>
          <IconLink /> Add URLs…
        </button>
      </div>
    {/if}
  </div>
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

<style>
  .split-btn {
    position: relative;
    display: inline-flex;
    align-items: stretch;
  }

  .split-primary {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .split-caret {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-left: 1px solid rgba(0, 0, 0, 0.15);
    padding-left: 2px;
    padding-right: 2px;
  }

  .add-menu {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 20;
    margin-top: 4px;
    min-width: 180px;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 4px;
    display: flex;
    flex-direction: column;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: none;
    background: none;
    text-align: left;
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
  }

  .menu-item:hover {
    background: #f0f0f0;
  }
</style>
