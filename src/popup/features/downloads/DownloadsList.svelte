<script lang="ts">
  import type { TaskPriorityAction } from "@api/client.js";
  import Search from "~icons/lucide/search";
  import { EmptyState, IconButton, SearchField, SegmentedControl } from "@ui";
  import { isReorderableStatus } from "@lib/tasks.js";
  import DownloadItem from "../../components/downloadItem/DownloadItem.svelte";
  import { showStatus } from "../../components/index.js";
  import { listDownloads, setTaskPriority } from "./downloadsManager.js";
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
  let activeMenuHash = $state<string | null>(null);

  function handleToggleMenu(hash: string, open: boolean): void {
    activeMenuHash = open ? hash : null;
  }

  async function handlePriority(hash: string, priority: TaskPriorityAction): Promise<void> {
    try {
      await setTaskPriority(hash, priority);
      const result = await listDownloads();
      if (!result.skipped) {
        view.tasks = result.tasks;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update priority";
      showStatus(message, "error", { autoHideMs: 3000 });
    }
  }

  const inProgressCount = $derived(view.tasks.filter((task) => isInProgress(task.status)).length);
  const visibleTasks = $derived(filterDownloads(view.tasks, filter, query));
  const canReorderQueue = $derived(
    view.tasks.length > 1 &&
      view.tasks.filter((task) => Boolean(task.hash) && isReorderableStatus(task.status)).length > 1,
  );

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

<div class="download-controls flex gap-[var(--spacing-xs)] mb-[var(--spacing-sm)]">
  <SegmentedControl
    size="sm"
    bind:value={filter}
    label="Filter downloads"
    items={[
      { value: "in-progress", label: "In progress", badge: inProgressCount },
      { value: "completed", label: "Completed" },
      { value: "all", label: "All" },
    ]}
  />
  <IconButton
    size="sm"
    class="search-toggle bg-transparent text-[var(--text-muted)] hover:bg-[var(--color-bg-raised)] hover:text-[var(--color-text)] hover:border-[var(--color-control-border)] aria-[expanded=true]:bg-[var(--color-primary-subtle)] aria-[expanded=true]:text-[var(--color-primary)] aria-[expanded=true]:border-[var(--color-primary-visual)] [&>svg]:w-[15px] [&>svg]:h-[15px]"
    aria-label="Search downloads"
    aria-expanded={searchOpen}
    title="Search downloads"
    onclick={() => {
      searchOpen = !searchOpen;
      if (!searchOpen) query = "";
    }}
  >
    <Search aria-hidden="true" />
  </IconButton>
</div>

{#if searchOpen}
  <div class="download-search-wrap -mt-[var(--spacing-sm)] mb-[var(--spacing-sm)]">
    <SearchField size="sm" placeholder="Search downloads" aria-label="Search downloads" bind:value={query} />
  </div>
{/if}

<svelte:window
  onclick={(e) => {
    if (activeMenuHash && e.target instanceof Element && !e.target.closest(".priority-menu-container")) {
      activeMenuHash = null;
    }
  }}
/>

<div id="downloads-list" class="flex flex-col gap-[var(--spacing-sm)] m-0 p-0" role="listbox" aria-label="Download tasks" aria-multiselectable="false">
  {#if visibleTasks.length === 0}
    <EmptyState>{emptyMessage}</EmptyState>
  {:else}
    {#each visibleTasks as task (task.id)}
      <DownloadItem
        {task}
        selectedHash={view.selectedHash}
        removing={view.removingHash === (task.hash ?? task.id)}
        menuOpen={activeMenuHash === task.hash}
        {canReorderQueue}
        onToggleMenu={handleToggleMenu}
        {onToggle}
        onPriority={handlePriority}
      />
    {/each}
  {/if}
</div>
