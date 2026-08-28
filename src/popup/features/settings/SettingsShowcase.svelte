<script lang="ts">
  import { onMount } from "svelte";

  import { seedChromeStorage } from "../../../../.storybook/chromeMock";

  import Settings from "./Settings.svelte";

  // In the extension the popup calls `load()` after mounting the panel. Storybook has no such
  // host, so the showcase does it — otherwise the form sits on defaults and every story looks
  // identical regardless of the state it seeds.
  type Props = {
    storage?: Record<string, unknown>;
    session?: Record<string, unknown>;
    initialTab?: "connection" | "appearance" | "advanced";
  };

  let { storage = {}, session = {}, initialTab = "connection" }: Props = $props();

  let panel = $state<Settings | null>(null);
  let ready = $state(false);

  onMount(async () => {
    seedChromeStorage(storage, session);
    await panel?.load();
    ready = true;
  });
</script>

<div class="showcase" class:ready>
  <Settings bind:this={panel} {initialTab} />
</div>

<style>
  .showcase {
    width: 360px;
    /* The popup is a fixed, narrow surface; reviewing settings at page width hides every
       wrapping and truncation problem the user actually sees. */
    max-width: 100%;
    opacity: 0;
    transition: opacity 0.1s ease;
  }

  .showcase.ready {
    opacity: 1;
  }
</style>
