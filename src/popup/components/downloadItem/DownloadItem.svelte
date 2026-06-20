<script lang="ts">
  import ArrowDown from "~icons/lucide/arrow-down";
  import ArrowUp from "~icons/lucide/arrow-up";

  import type { Task } from "@lib/tasks.js";
  import { DisclosureButton, ProgressBar } from "@ui";
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
    <p class="download-name" title={task.name}>{task.name}</p>
    {#if view.addedText}
      <p class="download-added">Added {view.addedText}</p>
    {/if}
    <div class="progress-container">
      <span class="progress-icon" aria-label={view.statusLabel}><StatusIcon status={task.status} /></span>
      <ProgressBar value={view.progress} variant={view.progressVariant} {selected} />
      <span class="download-speed" aria-label={view.speedLabel}>
        {#if view.isDownloadComplete}
          <ArrowUp aria-hidden="true" />
          <span>{view.uploadedText}</span>
          {#if view.ratioText}
            <span>• ratio {view.ratioText}</span>
          {/if}
          <ArrowUp aria-hidden="true" />
          <span>{view.uploadSpeedText}</span>
        {:else}
          <ArrowDown aria-hidden="true" />
          <span>{view.downloadSpeedText}</span>
          <ArrowUp aria-hidden="true" />
          <span>{view.uploadSpeedText}</span>
          {#if view.etaText}
            <span>• ETA: {view.etaText}</span>
          {/if}
        {/if}
      </span>
    </div>
    {#if canChooseFiles}
      <DisclosureButton
        expanded={filesOpen}
        onclick={(e) => {
          e.stopPropagation();
          filesOpen = !filesOpen;
        }}
      >
        {filesOpen ? "Hide files" : `Files (${task.totalFiles})`}
      </DisclosureButton>
      {#if filesOpen}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
          <TorrentFiles hash={view.hash} />
        </div>
      {/if}
    {/if}
  </div>
</article>
