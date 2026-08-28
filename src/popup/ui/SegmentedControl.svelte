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

  const sizeClasses = {
    sm: "min-h-[var(--control-height-sm)]",
    md: "min-h-[var(--control-height-md)] text-13px",
  } satisfies Record<ControlSize, string>;

  let { value = $bindable(), items, label = "Filter", size = "md", compact = false, onActivate }: Props = $props();
</script>

<div class={["flex gap-[var(--spacing-xs)]", compact ? "flex-none" : "flex-1"]} role="group" aria-label={label}>
  {#each items as item (item.value)}
    <button
      type="button"
      class={[
        "inline-flex items-center gap-[var(--spacing-xs)] justify-center px-[var(--spacing-sm)] py-[var(--spacing-xs)] border rounded-[var(--radius)] text-12px cursor-pointer transition-[background,color,border-color] duration-120 hover:text-[var(--color-text)] hover:border-[var(--color-primary-visual)]",
        compact ? "flex-none" : "flex-1",
        sizeClasses[size],
        value === item.value
          ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-text-inverse)]"
          : "bg-transparent border-[var(--color-control-border)] text-[var(--text-muted)]",
      ]}
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
