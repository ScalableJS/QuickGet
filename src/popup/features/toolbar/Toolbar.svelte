<script lang="ts">
  import IconSettings from "~icons/lucide/settings";
  import IconArrowLeft from "~icons/lucide/arrow-left";
  import IconPlay from "~icons/lucide/play";
  import IconStop from "~icons/lucide/circle-stop";
  import IconPause from "~icons/lucide/pause";
  import IconPlus from "~icons/lucide/plus";
  import IconFile from "~icons/lucide/file";
  import IconLink from "~icons/lucide/link";
  import IconTrash from "~icons/lucide/trash-2";
  import ArrowDown from "~icons/lucide/arrow-down";
  import ArrowUp from "~icons/lucide/arrow-up";

  import { IconButton, SplitButton } from "@ui";

  import { toolbarView } from "./toolbarView.svelte.js";

  type ToolbarActions = {
    start: () => void;
    stop: () => void;
    pause: () => void;
    remove: () => void;
    removeWithFiles: () => void;
    add: () => void;
    addUrls: () => void;
    toggleSettings: () => void;
  };

  let { actions }: { actions: ToolbarActions } = $props();

  const disabled = $derived(!toolbarView.hasSelection);
</script>

{#snippet plusIcon()}<IconPlus />{/snippet}
{#snippet fileIcon()}<IconFile />{/snippet}
{#snippet linkIcon()}<IconLink />{/snippet}
{#snippet trashIcon()}<IconTrash />{/snippet}

<div class="toolbar-left flex-none flex items-center gap-[var(--spacing-sm)] text-12px text-[var(--color-text-secondary)]">
  <IconButton
    size="sm"
    id="toolbar-settings"
    title={toolbarView.settingsExpanded ? "Back to downloads" : "Open settings"}
    aria-label={toolbarView.settingsExpanded ? "Back to downloads" : "Open settings"}
    aria-controls="settings-panel"
    aria-expanded={toolbarView.settingsExpanded}
    aria-pressed={toolbarView.settingsExpanded}
    onclick={actions.toggleSettings}
  >
    {#if toolbarView.settingsExpanded}
      <IconArrowLeft />
    {:else}
      <IconSettings />
    {/if}
  </IconButton>
  {#if !toolbarView.isIdle}
    <span
      id="status-speed"
      class="status-speed inline-flex items-center gap-1.5 text-11px font-500 px-2 py-0.5 bg-[var(--color-bg-raised)] border border-[var(--color-control-border)] rounded-[var(--radius)] select-none tabular-nums [&>svg]:w-3 [&>svg]:h-3 flex-none"
      aria-label={`Download ${toolbarView.statusDownloadSpeed}; upload ${toolbarView.statusUploadSpeed}`}
      aria-live="off"
    >
      <ArrowDown aria-hidden="true" class="text-[var(--color-primary-visual)] flex-none" />
      <span class="text-[var(--color-text)] min-w-[36px] text-right">{toolbarView.statusDownloadSpeed}</span>
      <ArrowUp aria-hidden="true" class="text-[var(--progress-fill-seeding)] flex-none" />
      <span class="text-[var(--color-text-secondary)] min-w-[36px] text-right">{toolbarView.statusUploadSpeed}</span>
    </span>
  {/if}
</div>
<div class="toolbar-actions flex-none flex items-center justify-end gap-[var(--spacing-xs)]">
  <IconButton
    size="sm"
    id="toolbar-play"
    title="Start selected download"
    aria-label="Start selected download"
    {disabled}
    aria-disabled={disabled}
    onclick={actions.start}
  >
    <IconPlay />
  </IconButton>
  <IconButton
    size="sm"
    id="toolbar-stop"
    title="Stop selected download"
    aria-label="Stop selected download"
    {disabled}
    aria-disabled={disabled}
    onclick={actions.stop}
  >
    <IconStop />
  </IconButton>
  <IconButton
    size="sm"
    id="toolbar-pause"
    title="Pause selected download"
    aria-label="Pause selected download"
    {disabled}
    aria-disabled={disabled}
    onclick={actions.pause}
  >
    <IconPause />
  </IconButton>
  <!-- Split button: primary click keeps the legacy .torrent flow; caret opens more add options. -->
  <SplitButton
    size="sm"
    id="toolbar-add"
    primaryLabel="Add torrent"
    primaryIcon={plusIcon}
    onPrimary={actions.add}
    menuLabel="More add options"
    items={[
      { label: "Add .torrent file", icon: fileIcon, onSelect: actions.add },
      { label: "Add URLs…", icon: linkIcon, onSelect: actions.addUrls },
    ]}
  />
  <SplitButton
    size="sm"
    id="toolbar-remove"
    primaryLabel="Remove selected download"
    primaryIcon={trashIcon}
    onPrimary={actions.remove}
    menuLabel="More remove options"
    items={[{ label: "Remove task and files…", icon: trashIcon, onSelect: actions.removeWithFiles }]}
    {disabled}
  />
</div>
