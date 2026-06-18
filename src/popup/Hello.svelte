<script lang="ts">
  // Phase 0 spike: proves Svelte 5 (runes) compiles, mounts, and reacts under
  // the MV3 popup CSP. Remove once the spike is validated.
  let { name = "world" }: { name?: string } = $props();
  let count = $state(0);
</script>

<button type="button" onclick={() => count++}>
  Svelte probe — {name} · clicked {count}
</button>

<style>
  button {
    font: inherit;
    padding: 4px 8px;
    cursor: pointer;
  }
</style>
