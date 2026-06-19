<script lang="ts">
  import type { Task, TaskStatus } from "@lib/tasks.js";
  import DownloadItem from "../../components/downloadItem/DownloadItem.svelte";
  import type { downloadsView } from "./downloadsView.svelte.js";

  let {
    view,
    onToggle,
  }: {
    view: typeof downloadsView;
    onToggle: (hash: string) => void;
  } = $props();

  type Filter = "downloading" | "completed" | "all";

  // Default to "all" on every open: the popup is a remote viewer, so the safe
  // default is to show every task and let the user narrow down — nothing is
  // hidden behind a filter they didn't choose. We never persist the last filter.
  let filter = $state<Filter>("all");

  // "completed" = finished OR seeding (seeding means the download itself is done).
  // "downloading" is therefore everything still in progress — and crucially excludes
  // seeders, which is the whole point: seeding tasks should not clutter the
  // "what's still downloading" view.
  const isCompleted = (status: TaskStatus): boolean => status === "finished" || status === "seeding";

  const matchesFilter = (task: Task): boolean => {
    if (filter === "all") return true;
    if (filter === "completed") return isCompleted(task.status);
    return !isCompleted(task.status);
  };

  const downloadingCount = $derived(view.tasks.filter((task) => !isCompleted(task.status)).length);
  const visibleTasks = $derived(view.tasks.filter(matchesFilter));

  const emptyMessage = $derived(
    filter === "completed"
      ? "Nothing completed yet"
      : filter === "all"
        ? "No tasks"
        : "No active downloads",
  );
</script>

<div class="download-filters" role="group" aria-label="Filter downloads">
  <button
    type="button"
    class="filter-btn"
    class:active={filter === "downloading"}
    aria-pressed={filter === "downloading"}
    onclick={() => (filter = "downloading")}
  >
    Downloading{#if downloadingCount > 0}<span class="filter-count">{downloadingCount}</span>{/if}
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

<div id="downloads-list" role="listbox" aria-label="Download tasks" aria-multiselectable="false">
  {#if visibleTasks.length === 0}
    <div class="download-empty" role="note">{emptyMessage}</div>
  {:else}
    {#each visibleTasks as task (task.id)}
      <DownloadItem {task} selectedHash={view.selectedHash} {onToggle} />
    {/each}
  {/if}
</div>
