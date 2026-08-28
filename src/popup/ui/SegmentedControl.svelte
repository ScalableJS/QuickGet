<script lang="ts" generics="T extends string">
  import type { Component } from "svelte";

  import Badge from "./Badge.svelte";
  import type { ControlSize } from "./controlSize.js";

  // `icon` replaces the visible label with a glyph; the label then names the button for
  // assistive tech and as a tooltip, so it stays required either way.
  type Item = { value: T; label: string; badge?: number; icon?: Component };

  type Props = {
    value: T;
    items: Item[];
    label?: string;
    size?: ControlSize;
    /** Size segments to their content and sit at their natural width instead of filling the row. */
    compact?: boolean;
    /** Called on selection. Use instead of `bind:value` when picking is itself the commit. */
    onActivate?: (value: T) => void;
  };

  let { value = $bindable(), items, label = "Filter", size = "md", compact = false, onActivate }: Props = $props();
</script>

<div class="segmented" class:compact role="group" aria-label={label}>
  {#each items as item (item.value)}
    <button
      type="button"
      class={["segment", `segment-${size}`]}
      class:active={value === item.value}
      class:icon-only={item.icon}
      aria-pressed={value === item.value}
      aria-label={item.icon ? item.label : undefined}
      title={item.icon ? item.label : undefined}
      onclick={() => {
        value = item.value;
        onActivate?.(item.value);
      }}
    >
      {#if item.icon}
        <item.icon aria-hidden="true" />
      {:else}
        {item.label}
      {/if}
      {#if item.badge}<Badge>{item.badge}</Badge>{/if}
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

  .segmented.compact {
    flex: 0 0 auto;
  }

  .segmented.compact .segment {
    flex: 0 0 auto;
  }

  .icon-only {
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .segment.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-text-inverse);
  }
</style>
