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
    removing = false,
    onToggle,
  }: {
    task: Task;
    selectedHash?: string | null;
    removing?: boolean;
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
    if (removing) return;
    onToggle(view.hash);
  }

  function handleKey(event: KeyboardEvent): void {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    toggle();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<div
  bind:this={el}
  class={[
    "download-item flex flex-col [@media(min-width:601px)]:flex-row p-[var(--space-3)] border rounded-[var(--radius)] text-[var(--torrent-text-primary)] transition-[background,border-color] duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-primary-visual)] focus-visible:outline-offset-2",
    task.status === "error"
      ? selected
        ? "border-[var(--download-error-selected-border)] bg-[var(--download-error-selected-bg)]"
        : "border-[var(--download-error-border)] bg-[var(--download-error-bg)]"
      : selected
        ? "border-[var(--download-selected-border)] bg-[var(--download-selected-bg)]"
        : "border-[var(--torrent-border)] bg-[var(--torrent-bg)] hover:border-[var(--download-hover-border)] hover:bg-[var(--download-hover-bg)]",
    selected && "selected",
    removing && "opacity-60 pointer-events-none removing",
  ]}
  data-hash={view.hash}
  data-status={task.status}
  tabindex="0"
  role="option"
  aria-selected={selected}
  aria-disabled={removing}
  onclick={toggle}
  onkeydown={handleKey}
>
  <div class="download-info flex-1 min-w-0 w-full flex flex-col gap-[var(--spacing-xs)]">
    <p
      class={[
        "download-name m-0 font-500 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
        task.status === "error" ? "text-[var(--torrent-text-error)]" : "text-[var(--torrent-text-primary)]",
      ]}
      title={task.name}
    >
      {task.name}
    </p>
    {#if view.addedText}
      <p class="download-added m-0 text-12px text-[var(--color-text-secondary)]">Added {view.addedText}</p>
    {/if}
    <div class="download-meta flex items-center gap-[var(--spacing-sm)] min-w-0">
      <span
        class={[
          "download-status inline-flex items-center gap-[var(--space-1)] min-w-0 text-12px whitespace-nowrap",
          task.status === "error" ? "text-[var(--torrent-text-error)]" : "text-[var(--torrent-text-secondary)]",
        ]}
      >
        {view.statusLabel}:
      </span>
      <span
        class={[
          "download-speed inline-flex items-center gap-[var(--space-1)] text-12px text-right flex-none whitespace-nowrap tabular-nums [&>svg]:w-3 [&>svg]:h-3 [&>svg]:flex-none",
          task.status === "error"
            ? "text-[var(--torrent-text-error)]"
            : "text-[var(--torrent-text-secondary)]",
        ]}
        aria-label={view.speedLabel}
      >
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
    <div class="progress-container flex items-center gap-[var(--spacing-sm)] w-full">
      <span class="progress-icon text-12px leading-none flex-none inline-flex items-center justify-center" aria-label={view.statusLabel}>
        <StatusIcon status={task.status} />
      </span>
      <ProgressBar value={view.progress} label={`${view.statusLabel} progress`} variant={view.progressVariant} inline />
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
</div>
