<script lang="ts">
  import ArrowDown from "~icons/lucide/arrow-down";
  import ArrowUp from "~icons/lucide/arrow-up";
  import ArrowUpToLine from "~icons/lucide/arrow-up-to-line";
  import EllipsisVertical from "~icons/lucide/ellipsis-vertical";

  import type { TaskPriorityAction } from "@api/client.js";
  import type { Task } from "@lib/tasks.js";
  import { DisclosureButton, ProgressBar } from "@ui";
  import TorrentFiles from "../../features/torrentFiles/TorrentFiles.svelte";
  import { getDownloadItemView } from "./format.js";
  import StatusIcon from "./StatusIcon.svelte";

  const REORDERABLE_STATUSES = new Set([
    "downloading",
    "downloadingMetadata",
    "queued",
    "queuedChecking",
    "checking",
    "allocating",
  ]);

  let {
    task,
    selectedHash = null,
    removing = false,
    menuOpen = false,
    onToggleMenu,
    onToggle,
    onPriority,
  }: {
    task: Task;
    selectedHash?: string | null;
    removing?: boolean;
    menuOpen?: boolean;
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

  // Priority reordering applies strictly to active and queued downloads in the NAS queue with a valid hash.
  const canReorder = $derived(Boolean(task.hash) && REORDERABLE_STATUSES.has(task.status));

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
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % count;
      itemEls[activeIndex]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + count) % count;
      itemEls[activeIndex]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      closeMenu(true);
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
              class="priority-menu-btn inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)] transition-colors"
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
                if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
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
                class="priority-menu absolute right-0 top-full mt-1 z-30 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-md)] py-1 min-w-[130px] flex flex-col text-12px"
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
                  tabindex={activeIndex === 0 ? 0 : -1}
                  class="flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--color-bg-hover)] focus-visible:bg-[var(--color-bg-hover)] focus-visible:outline-none text-[var(--color-text)] text-left cursor-pointer transition-colors"
                  onclick={() => handleSetPriority("top")}
                >
                  <ArrowUpToLine class="w-3.5 h-3.5 text-[var(--color-primary-visual)] flex-none" />
                  <span>Move to top</span>
                </button>
                <button
                  bind:this={itemEls[1]}
                  type="button"
                  role="menuitem"
                  tabindex={activeIndex === 1 ? 0 : -1}
                  class="flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--color-bg-hover)] focus-visible:bg-[var(--color-bg-hover)] focus-visible:outline-none text-[var(--color-text)] text-left cursor-pointer transition-colors"
                  onclick={() => handleSetPriority("up")}
                >
                  <ArrowUp class="w-3.5 h-3.5 text-[var(--color-text-secondary)] flex-none" />
                  <span>Move up</span>
                </button>
                <button
                  bind:this={itemEls[2]}
                  type="button"
                  role="menuitem"
                  tabindex={activeIndex === 2 ? 0 : -1}
                  class="flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--color-bg-hover)] focus-visible:bg-[var(--color-bg-hover)] focus-visible:outline-none text-[var(--color-text)] text-left cursor-pointer transition-colors"
                  onclick={() => handleSetPriority("down")}
                >
                  <ArrowDown class="w-3.5 h-3.5 text-[var(--color-text-secondary)] flex-none" />
                  <span>Move down</span>
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
              <span class="inline-flex items-center gap-0.5 text-[var(--progress-fill-seeding)] font-500 tabular-nums">
                <ArrowUp aria-hidden="true" />
                <span>{view.uploadSpeedText}</span>
              </span>
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
              <span class="inline-flex items-center gap-0.5 text-[var(--color-primary-visual)] font-500 tabular-nums">
                <ArrowDown aria-hidden="true" />
                <span>{view.downloadSpeedText}</span>
              </span>
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
