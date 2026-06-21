<script lang="ts">
  import type { Task } from "@lib/tasks.js";
  import DownloadsList from "./DownloadsList.svelte";

  let { tasks }: { tasks: Task[] } = $props();

  const view = $state<{ tasks: Task[]; selectedHash: string | null; removingHash: string | null }>({
    tasks: [],
    selectedHash: null,
    removingHash: null,
  });

  $effect(() => {
    view.tasks = tasks;
  });
</script>

<DownloadsList {view} onToggle={() => {}} />
