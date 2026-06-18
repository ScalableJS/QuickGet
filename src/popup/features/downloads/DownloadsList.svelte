<script lang="ts">
  import DownloadItem from "../../components/downloadItem/DownloadItem.svelte";
  import type { downloadsView } from "./downloadsView.svelte.js";

  let {
    view,
    onToggle,
  }: {
    view: typeof downloadsView;
    onToggle: (hash: string) => void;
  } = $props();
</script>

{#if view.tasks.length === 0}
  <div class="download-empty" role="note">No active downloads</div>
{:else}
  {#each view.tasks as task (task.id)}
    <DownloadItem {task} selectedHash={view.selectedHash} {onToggle} />
  {/each}
{/if}
