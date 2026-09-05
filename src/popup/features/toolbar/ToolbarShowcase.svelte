<script lang="ts">
  import Toolbar from "./Toolbar.svelte";
  import { toolbarView } from "./toolbarView.svelte.js";

  let {
    hasSelection = false,
    settingsExpanded = false,
    isIdle = false,
  }: { hasSelection?: boolean; settingsExpanded?: boolean; isIdle?: boolean } = $props();

  $effect(() => {
    toolbarView.hasSelection = hasSelection;
    toolbarView.settingsExpanded = settingsExpanded;
    toolbarView.isIdle = isIdle;
    toolbarView.statusDownloadSpeed = isIdle ? "0 B/s" : "12.0 MB/s";
    toolbarView.statusUploadSpeed = isIdle ? "0 B/s" : "0.8 MB/s";
  });

  const noop = (): void => {};
  const actions = {
    start: noop,
    stop: noop,
    pause: noop,
    remove: noop,
    removeWithFiles: noop,
    add: noop,
    addUrls: noop,
    toggleSettings: () => {
      toolbarView.settingsExpanded = !toolbarView.settingsExpanded;
    },
  };
</script>

<header class="toolbar flex justify-between items-center bg-[var(--color-bg-alt)] text-[var(--color-text)] px-[var(--spacing-md)] py-[var(--spacing-sm)] border-0 border-b border-solid border-b-[var(--color-border)] shadow-[var(--shadow)]" style="position: static;">
  <Toolbar {actions} />
</header>
