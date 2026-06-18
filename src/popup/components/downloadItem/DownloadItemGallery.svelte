<script lang="ts">
  import type { Task, TaskStatus } from "@lib/tasks.js";

  import DownloadItem from "./DownloadItem.svelte";

  const STATUSES: TaskStatus[] = [
    "queued",
    "downloading",
    "seeding",
    "paused",
    "stopped",
    "checking",
    "repairing",
    "extracting",
    "finishing",
    "finished",
    "error",
  ];

  function sample(status: TaskStatus): Task {
    const downloading = status === "downloading";
    const seeding = status === "seeding";
    return {
      id: status,
      hash: status,
      name: `Ubuntu 24.04 LTS — ${status}`,
      status,
      progress: status === "finished" || seeding ? 100 : 42,
      sizeBytes: 2_400_000_000,
      downloadedBytes: 1_000_000_000,
      uploadedBytes: 620_000_000,
      downSpeedBps: downloading ? 12_000_000 : 0,
      upSpeedBps: seeding ? 800_000 : 0,
      shareRatio: seeding ? 0.48 : undefined,
      etaSec: downloading ? 2400 : undefined,
      source: "qnap",
    };
  }
</script>

<div class="list">
  {#each STATUSES as status (status)}
    <DownloadItem task={sample(status)} onToggle={() => {}} />
  {/each}
</div>

<style>
  .list {
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
