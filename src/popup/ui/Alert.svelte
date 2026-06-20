<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    tone?: "hint" | "error" | "warning";
    children: Snippet;
  };

  let { tone = "hint", children }: Props = $props();
</script>

<p class="alert alert-{tone}" aria-live={tone === "hint" ? "off" : "polite"}>{@render children()}</p>

<style>
  .alert {
    margin: 0;
    font-size: 12px;
  }

  .alert-hint {
    color: var(--color-text-secondary);
  }

  .alert-error {
    color: var(--color-error);
  }

  .alert-warning {
    color: var(--color-warning);
  }
</style>
