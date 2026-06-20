<script lang="ts">
  import type { Task } from "@lib/tasks.js";
  import DownloadsList from "./DownloadsList.svelte";

  let { tasks }: { tasks: Task[] } = $props();

  const view = $state<{ tasks: Task[]; selectedHash: string | null }>({ tasks: [], selectedHash: null });

  $effect(() => {
    view.tasks = tasks;
  });
</script>

<DownloadsList {view} onToggle={() => {}} />
