<script lang="ts">
  import type { Task } from "@lib/tasks.js";
  import TorrentFiles from "../../features/torrentFiles/TorrentFiles.svelte";
  import { getDownloadItemView } from "./format.js";
  import StatusIcon from "./StatusIcon.svelte";

  let {
    task,
    selectedHash = null,
    onToggle,
  }: {
    task: Task;
    selectedHash?: string | null;
    onToggle: (hash: string) => void;
  } = $props();

  const view = $derived(getDownloadItemView(task));
  const selected = $derived(view.hash === selectedHash);

  // File selection is only possible on active multi-file tasks (the NAS rejects it
  // once the task is finished — verified live: error 16387 on completed tasks).
  const canChooseFiles = $derived(
    Boolean(view.hash) && (task.totalFiles ?? 0) > 1 && task.status !== "finished" && task.status !== "seeding",
  );
  let filesOpen = $state(false);

  let el = $state<HTMLElement | null>(null);

  // Mirror the legacy behaviour of focusing the selected item.
  $effect(() => {
    if (selected) el?.focus({ preventScroll: false });
  });

  function toggle(): void {
    onToggle(view.hash);
  }

  function handleKey(event: KeyboardEvent): void {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    toggle();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<article
  bind:this={el}
  class="download-item"
  class:selected
  data-hash={view.hash}
  data-status={task.status}
  tabindex="0"
  role="option"
  aria-selected={selected}
  onclick={toggle}
  onkeydown={handleKey}
>
  <div class="download-info">
    <p class="download-name">{task.name}</p>
    <div class="download-meta">
      <span class="download-status">{view.statusText}</span>
      <span class="download-speed">{view.metaText}{view.etaSuffix}</span>
    </div>
    {#if view.addedText}
      <p class="download-added">Added {view.addedText}</p>
    {/if}
    <div class="progress-container">
      <span class="progress-icon" aria-label={view.statusLabel}><StatusIcon status={task.status} /></span>
      <div class="progress-bar">
        <div class="progress-fill {view.progressModifier}" style="width: {view.progress}%"></div>
      </div>
    </div>
    {#if canChooseFiles}
      <button
        type="button"
        class="files-toggle"
        aria-expanded={filesOpen}
        onclick={(e) => {
          e.stopPropagation();
          filesOpen = !filesOpen;
        }}
      >
        {filesOpen ? "Hide files" : `Files (${task.totalFiles})`}
      </button>
      {#if filesOpen}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
          <TorrentFiles hash={view.hash} />
        </div>
      {/if}
    {/if}
  </div>
</article>

<style>
  .files-toggle {
    margin-top: 6px;
    background: none;
    border: 1px solid #d0d0d0;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 12px;
    cursor: pointer;
    color: #2196f3;
  }

  .files-toggle:hover {
    background: #f0f0f0;
  }
</style>
