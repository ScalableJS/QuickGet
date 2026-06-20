<script lang="ts">
  import Search from "~icons/lucide/search";
  import DownloadItem from "../../components/downloadItem/DownloadItem.svelte";
  import { filterDownloads, isInProgress, type DownloadFilter } from "./downloadFilters.js";
  import type { downloadsView } from "./downloadsView.svelte.js";

  let {
    view,
    onToggle,
  }: {
    view: typeof downloadsView;
    onToggle: (hash: string) => void;
  } = $props();

  let filter = $state<DownloadFilter>("in-progress");
  let searchOpen = $state(false);
  let query = $state("");

  const inProgressCount = $derived(view.tasks.filter((task) => isInProgress(task.status)).length);
  const visibleTasks = $derived(filterDownloads(view.tasks, filter, query));

  const emptyMessage = $derived(
    query.trim()
      ? `No downloads match “${query.trim()}”`
      : filter === "completed"
      ? "Nothing completed yet"
      : filter === "all"
        ? "No tasks"
        : "No downloads in progress",
  );
</script>

<div class="download-controls">
  <div class="download-filters" role="group" aria-label="Filter downloads">
    <button
      type="button"
      class="filter-btn"
      class:active={filter === "in-progress"}
      aria-pressed={filter === "in-progress"}
      onclick={() => (filter = "in-progress")}
    >
      In progress{#if inProgressCount > 0}<span class="filter-count">{inProgressCount}</span>{/if}
    </button>
    <button
      type="button"
      class="filter-btn"
      class:active={filter === "completed"}
      aria-pressed={filter === "completed"}
      onclick={() => (filter = "completed")}
    >
      Completed
    </button>
    <button
      type="button"
      class="filter-btn"
      class:active={filter === "all"}
      aria-pressed={filter === "all"}
      onclick={() => (filter = "all")}
    >
      All
    </button>
  </div>
  <button
    type="button"
    class="search-toggle"
    aria-label="Search downloads"
    aria-expanded={searchOpen}
    title="Search downloads"
    onclick={() => {
      searchOpen = !searchOpen;
      if (!searchOpen) query = "";
    }}
  >
    <Search aria-hidden="true" />
  </button>
</div>

{#if searchOpen}
  <input class="download-search" type="search" placeholder="Search downloads" aria-label="Search downloads" bind:value={query} />
{/if}

<div id="downloads-list" role="listbox" aria-label="Download tasks" aria-multiselectable="false">
  {#if visibleTasks.length === 0}
    <div class="download-empty" role="note">{emptyMessage}</div>
  {:else}
    {#each visibleTasks as task (task.id)}
      <DownloadItem {task} selectedHash={view.selectedHash} {onToggle} />
    {/each}
  {/if}
</div>
