<script lang="ts">
  import type { Task } from "@lib/tasks.js";
  import DownloadsList from "./DownloadsList.svelte";

  let { tasks }: { tasks: Task[] } = $props();

  const view = $derived<{ tasks: Task[]; selectedHash: string | null; removingHash: string | null }>({
    tasks,
    selectedHash: null,
    removingHash: null,
  });
</script>

<DownloadsList {view} onToggle={() => {}} />
