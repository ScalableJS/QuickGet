<script lang="ts">
  import type { Task } from "@lib/tasks.js";
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
  </div>
</article>
