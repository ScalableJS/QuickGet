<script lang="ts">
  import ArrowDown from "~icons/lucide/arrow-down";
  import ArrowUp from "~icons/lucide/arrow-up";
  import ArrowUpToLine from "~icons/lucide/arrow-up-to-line";
  import EllipsisVertical from "~icons/lucide/ellipsis-vertical";

  import type { TaskPriorityAction } from "@api/client.js";
  import { isReorderableStatus, type Task } from "@lib/tasks.js";
  import { DisclosureButton, ProgressBar, SpeedTelemetry } from "@ui";
  import TorrentFiles from "../../features/torrentFiles/TorrentFiles.svelte";
  import { getDownloadItemView } from "./format.js";
  import StatusIcon from "./StatusIcon.svelte";

  let {
    task,
    selectedHash = null,
    removing = false,
    menuOpen = false,
    canReorderQueue = false,
    onToggleMenu,
    onToggle,
    onPriority,
  }: {
    task: Task;
    selectedHash?: string | null;
    removing?: boolean;
    menuOpen?: boolean;
    canReorderQueue?: boolean;
    onToggleMenu?: (hash: string, open: boolean) => void;
    onToggle: (hash: string) => void;
    onPriority?: (hash: string, priority: TaskPriorityAction) => Promise<void> | void;
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

  // Priority reordering applies only when multiple tasks exist in the queue and this task is active/queued.
  const canReorder = $derived(
    canReorderQueue && Boolean(task.hash) && isReorderableStatus(task.status),
  );

  let triggerBtnEl = $state<HTMLButtonElement>();
  let itemEls = $state<HTMLButtonElement[]>([]);
  let activeIndex = $state(0);
  let isUpdatingPriority = $state(false);

  function openMenu(): void {
    if (!task.hash || !onToggleMenu) return;
    onToggleMenu(task.hash, true);
    activeIndex = 0;
    queueMicrotask(() => itemEls[0]?.focus());
  }

  function closeMenu(focusTrigger = true): void {
    if (task.hash && onToggleMenu) {
      onToggleMenu(task.hash, false);
    }
    if (focusTrigger) {
      triggerBtnEl?.focus();
    }
  }

  async function handleSetPriority(priority: TaskPriorityAction): Promise<void> {
    closeMenu(true);
    if (!onPriority || isUpdatingPriority || !task.hash) return;
    try {
      isUpdatingPriority = true;
      await onPriority(task.hash, priority);
    } finally {
      isUpdatingPriority = false;
    }
  }

  function onMenuKeydown(e: KeyboardEvent): void {
    const count = 3;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % count;
      itemEls[activeIndex]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + count) % count;
      itemEls[activeIndex]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === "Tab") {
      closeMenu(false);
    } else if (e.key === "Home") {
      e.preventDefault();
      activeIndex = 0;
      itemEls[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      activeIndex = count - 1;
      itemEls[activeIndex]?.focus();
    }
  }

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
    "download-item flex flex-col [@media(min-width:601px)]:flex-row p-[var(--space-3)] border border-solid rounded-[var(--radius-container)] text-[var(--torrent-text-primary)] transition-[background-color,border-color,box-shadow,transform] duration-[var(--duration-base)] ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
    task.status === "error"
      ? selected
        ? "border-[var(--download-error-selected-border)] bg-[var(--download-error-selected-bg)]"
        : "border-[var(--download-error-border)] bg-[var(--download-error-bg)]"
      : selected
        ? "border-transparent bg-[var(--download-selected-bg)]"
        : "border-transparent bg-[var(--torrent-bg)] hover:border-[var(--download-hover-border)] hover:bg-[var(--download-hover-bg)] hover:shadow-[0_6px_16px_rgb(23_32_51_/_10%)]",
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
    <div class="flex items-center justify-between gap-2 min-w-0">
      <p
        class={[
          "download-name m-0 font-500 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
          task.status === "error" ? "text-[var(--torrent-text-error)]" : "text-[var(--torrent-text-primary)]",
        ]}
        title={task.name}
      >
        {task.name}
      </p>
      <div class="flex items-center gap-1.5 flex-none">
        {#if view.swarmText}
          <span
            class="download-swarm text-11px text-[var(--color-text-secondary)] tabular-nums"
            title="Seeds & Peers in swarm"
          >
            {view.swarmText}
          </span>
        {/if}
        {#if canReorder && onPriority}
          <div class="priority-menu-container relative inline-flex items-center">
            <button
              bind:this={triggerBtnEl}
              type="button"
              class="priority-menu-btn inline-flex items-center justify-center w-6 h-6 rounded-[var(--radius)] bg-transparent hover:bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-transparent hover:border-[var(--color-control-border)] aria-[expanded=true]:bg-[var(--color-bg-raised)] aria-[expanded=true]:border-[var(--color-control-border)] aria-[expanded=true]:text-[var(--color-primary-visual)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              aria-label="Queue priority options"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title="Queue priority"
              disabled={isUpdatingPriority}
              onclick={(e) => {
                e.stopPropagation();
                menuOpen ? closeMenu(false) : openMenu();
              }}
              onkeydown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
                  if (!menuOpen) {
                    e.preventDefault();
                    openMenu();
                  }
                }
              }}
            >
              <EllipsisVertical class="w-3.5 h-3.5" />
            </button>
            {#if menuOpen}
              <div
                class="priority-menu absolute right-0 top-full mt-1 z-30 flex items-center p-0.5 bg-[var(--menu-bg)] border border-[var(--color-control-border)] rounded-[var(--radius)] shadow-[var(--shadow)]"
                role="menu"
                tabindex="-1"
                aria-label="Queue priority options"
                onclick={(e) => e.stopPropagation()}
                onkeydown={onMenuKeydown}
              >
                <button
                  bind:this={itemEls[0]}
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  title="Move to top"
                  aria-label="Move to top"
                  class="flex items-center justify-center w-7 h-7 rounded-[4px] border-0 bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-primary-visual)] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none transition-colors cursor-pointer"
                  onclick={() => handleSetPriority("top")}
                >
                  <ArrowUpToLine class="w-4 h-4 text-[var(--color-primary-visual)]" />
                </button>
                <div class="w-px h-3.5 bg-[var(--color-control-border)] opacity-40 mx-0.5"></div>
                <button
                  bind:this={itemEls[1]}
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  title="Move up"
                  aria-label="Move up"
                  class="flex items-center justify-center w-7 h-7 rounded-[4px] border-0 bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none transition-colors cursor-pointer"
                  onclick={() => handleSetPriority("up")}
                >
                  <ArrowUp class="w-4 h-4" />
                </button>
                <div class="w-px h-3.5 bg-[var(--color-control-border)] opacity-40 mx-0.5"></div>
                <button
                  bind:this={itemEls[2]}
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  title="Move down"
                  aria-label="Move down"
                  class="flex items-center justify-center w-7 h-7 rounded-[4px] border-0 bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none transition-colors cursor-pointer"
                  onclick={() => handleSetPriority("down")}
                >
                  <ArrowDown class="w-4 h-4" />
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <div class="progress-container flex items-center gap-[var(--spacing-sm)] w-full">
      <span class="progress-icon text-12px leading-none flex-none inline-flex items-center justify-center" aria-label={view.statusLabel}>
        <StatusIcon status={task.status} />
      </span>
      <ProgressBar value={view.progress} label={`${view.statusLabel} progress`} variant={view.progressVariant} inline />
      <span class="text-11px text-[var(--color-text-secondary)] tabular-nums flex-none min-w-[28px] text-right">
        {view.progress}%
      </span>
    </div>

    <div class="download-meta flex items-center justify-between gap-2 min-w-0 text-12px">
      {#if task.status === "error"}
        <span class="download-status min-w-0 flex-1 text-[var(--torrent-text-error)] font-500 truncate" title={view.errorDetail}>
          {view.errorDetail}
        </span>
        {#if view.sizeText}
          <span class="text-[var(--color-text-secondary)] tabular-nums flex-none">{view.sizeText}</span>
        {/if}
      {:else}
        <div class="flex items-center gap-1.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[var(--torrent-text-secondary)]">
          <span
            class={[
              "download-status font-500 flex-none",
              task.status === "seeding"
                ? "text-[var(--progress-fill-seeding)]"
                : task.status === "downloading"
                  ? "text-[var(--color-primary-visual)]"
                  : "text-[var(--torrent-text-primary)]",
            ]}
          >
            {view.statusLabel}
          </span>

          {#if view.sizeText}
            <span class="text-[var(--color-text-muted)]">•</span>
            <span class="tabular-nums flex-none">{view.sizeText}</span>
          {/if}

          {#if task.status === "seeding"}
            {#if task.upSpeedBps > 0}
              <span class="text-[var(--color-text-muted)]">•</span>
              <SpeedTelemetry direction="up" value={view.uploadSpeedText} class="font-500" />
            {/if}
            {#if view.etaText}
              <span class="text-[var(--color-text-muted)]">•</span>
              <span>ETA: {view.etaText}</span>
            {/if}
            {#if view.ratioText}
              <span class="text-[var(--color-text-muted)]">•</span>
              <span>Ratio {view.ratioText}</span>
            {/if}
          {:else if !view.isDownloadComplete}
            {#if task.downSpeedBps > 0}
              <span class="text-[var(--color-text-muted)]">•</span>
              <SpeedTelemetry direction="down" value={view.downloadSpeedText} class="font-500" />
            {/if}
            {#if view.etaText}
              <span class="text-[var(--color-text-muted)]">•</span>
              <span>{view.etaText}</span>
            {/if}
          {/if}
        </div>

        {#if view.addedText && !view.swarmText}
          <span class="text-11px text-[var(--color-text-muted)] flex-none">{view.addedText}</span>
        {/if}
      {/if}
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
