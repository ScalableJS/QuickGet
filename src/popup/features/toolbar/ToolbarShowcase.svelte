<script lang="ts">
  import Toolbar from "./Toolbar.svelte";
  import { toolbarView } from "./toolbarView.svelte.js";

  let {
    hasSelection = false,
    settingsExpanded = false,
  }: { hasSelection?: boolean; settingsExpanded?: boolean } = $props();

  $effect(() => {
    toolbarView.hasSelection = hasSelection;
    toolbarView.settingsExpanded = settingsExpanded;
    toolbarView.statusDownloadSpeed = "12.0 MB/s";
    toolbarView.statusUploadSpeed = "0.8 MB/s";
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

<header class="toolbar" style="position: static;">
  <Toolbar {actions} />
</header>
