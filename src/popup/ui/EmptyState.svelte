<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    children: Snippet;
  };

  let { children }: Props = $props();
</script>

<p class="empty-state" role="note">{@render children()}</p>

<style>
  .empty-state {
    margin: 0;
    padding: var(--spacing-md);
    color: var(--color-text-secondary);
    font-size: 13px;
  }
</style>
