<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    variant?: "count" | "accent";
    title?: string;
    children: Snippet;
  };

  let { variant = "count", title, children }: Props = $props();
</script>

<span class="badge badge-{variant}" {title}>{@render children()}</span>

<style>
  .badge {
    display: inline-block;
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  /* Tinted by the parent's text colour — used inside filter buttons. */
  .badge-count {
    min-width: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 22%, transparent);
    line-height: 16px;
  }

  /* Solid accent pill — used standalone (e.g. URL count). */
  .badge-accent {
    margin-left: 4px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--color-primary);
    color: var(--color-text-inverse);
  }
</style>
