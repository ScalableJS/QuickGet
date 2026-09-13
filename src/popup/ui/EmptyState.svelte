<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    children: Snippet;
  };

  let { children }: Props = $props();
</script>

<p class="m-0 p-4 text-[var(--color-text-secondary)] text-13px" role="note">
  {@render children()}
</p>
