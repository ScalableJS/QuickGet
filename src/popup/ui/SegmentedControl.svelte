<script lang="ts" generics="T extends string">
  import Badge from "./Badge.svelte";
  import type { ControlSize } from "./controlSize.js";

  type Item = { value: T; label: string; badge?: number };

  type Props = {
    value: T;
    items: Item[];
    label?: string;
    size?: ControlSize;
  };

  let { value = $bindable(), items, label = "Filter", size = "md" }: Props = $props();
</script>

<div class="segmented" role="group" aria-label={label}>
  {#each items as item (item.value)}
    <button
      type="button"
      class={["segment", `segment-${size}`]}
      class:active={value === item.value}
      aria-pressed={value === item.value}
      onclick={() => (value = item.value)}
    >
      {item.label}{#if item.badge}<Badge>{item.badge}</Badge>{/if}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    flex: 1;
    gap: var(--spacing-xs);
  }

  .segment {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex: 1;
    min-height: var(--control-height-md);
    justify-content: center;
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius);
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    transition:
      background 0.12s ease,
      color 0.12s ease,
      border-color 0.12s ease;
  }

  .segment-sm {
    min-height: var(--control-height-sm);
  }

  .segment-md {
    font-size: 13px;
  }

  .segment:hover {
    color: var(--color-text);
    border-color: var(--color-primary-visual);
  }

  .segment.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-text-inverse);
  }
</style>
