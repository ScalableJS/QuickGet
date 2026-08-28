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
    initialTab?: "connection" | "advanced";
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

<div class={["w-[360px] max-w-full transition-opacity duration-100 ease-out", ready ? "opacity-100" : "opacity-0"]}>
  <Settings bind:this={panel} {initialTab} />
</div>
