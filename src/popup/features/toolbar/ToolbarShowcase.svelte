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
    toolbarView.statusSpeed = "↓ 12.0 MB/s ↑ 0.8 MB/s";
  });

  const noop = (): void => {};
  const actions = {
    start: noop,
    stop: noop,
    pause: noop,
    remove: noop,
    add: noop,
    toggleSettings: () => {
      toolbarView.settingsExpanded = !toolbarView.settingsExpanded;
    },
  };
</script>

<header class="toolbar" style="position: static;">
  <Toolbar {actions} />
</header>
