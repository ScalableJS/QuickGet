<script lang="ts">
  import type { Task, TaskStatus } from "@lib/tasks.js";

  import DownloadItem from "./DownloadItem.svelte";

  const STATUSES: { status: TaskStatus; qnapState: string; label: string; group: string }[] = [
    { status: "queued", qnapState: "0", label: "Waiting", group: "In progress" },
    { status: "paused", qnapState: "1", label: "Paused", group: "In progress" },
    { status: "stopped", qnapState: "2", label: "Stopped", group: "Inactive" },
    { status: "moving", qnapState: "3", label: "Moving", group: "In progress" },
    { status: "error", qnapState: "4", label: "Failed", group: "Failed" },
    { status: "finished", qnapState: "5", label: "Finished", group: "Completed" },
    { status: "seeding", qnapState: "100", label: "Seeding", group: "Completed" },
    { status: "queuedChecking", qnapState: "101", label: "Queued for checking", group: "In progress" },
    { status: "checking", qnapState: "102", label: "Checking files", group: "In progress" },
    { status: "downloadingMetadata", qnapState: "103", label: "Downloading metadata", group: "In progress" },
    { status: "downloading", qnapState: "104", label: "Downloading", group: "In progress" },
    { status: "allocating", qnapState: "105", label: "Allocating", group: "In progress" },
    { status: "repairing", qnapState: "—", label: "Repairing", group: "In progress" },
    { status: "extracting", qnapState: "—", label: "Extracting", group: "In progress" },
    { status: "finishing", qnapState: "—", label: "Finishing", group: "In progress" },
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

<div class="max-w-[960px] flex flex-col gap-6">
  <section class="flex flex-col gap-3">
    <div>
      <h2 class="m-0 text-18px font-600 text-[var(--color-text)]">QNAP status matrix</h2>
      <p class="mt-1 mb-0 text-12px text-[var(--color-text-secondary)]">
        Download Station 5.10.2 numeric states and their QuickGet presentation.
      </p>
    </div>
    <div class="overflow-x-auto border border-solid border-[var(--torrent-border)] rounded-[var(--radius)]">
      <table class="w-full border-collapse text-left text-12px text-[var(--color-text)]">
        <thead class="bg-[var(--torrent-bg)]">
          <tr>
            <th class="p-2 border-0 border-b border-solid border-[var(--torrent-border)]">QNAP code</th>
            <th class="p-2 border-0 border-b border-solid border-[var(--torrent-border)]">Download Station</th>
            <th class="p-2 border-0 border-b border-solid border-[var(--torrent-border)]">QuickGet status</th>
            <th class="p-2 border-0 border-b border-solid border-[var(--torrent-border)]">Tab/group</th>
          </tr>
        </thead>
        <tbody>
          {#each STATUSES as item (item.status)}
            <tr>
              <td class="p-2 border-0 border-b border-solid border-[var(--torrent-border)] font-mono tabular-nums">{item.qnapState}</td>
              <td class="p-2 border-0 border-b border-solid border-[var(--torrent-border)]">{item.label}</td>
              <td class="p-2 border-0 border-b border-solid border-[var(--torrent-border)] font-mono">{item.status}</td>
              <td class="p-2 border-0 border-b border-solid border-[var(--torrent-border)]">{item.group}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="flex flex-col gap-3">
    <h2 class="m-0 text-18px font-600 text-[var(--color-text)]">Status cards</h2>
    <div
      class="max-w-[420px] flex flex-col gap-2"
      role="listbox"
      aria-label="Download task status examples"
      aria-multiselectable="false"
    >
      {#each STATUSES as item (item.status)}
        <DownloadItem task={sample(item.status)} onToggle={() => {}} />
      {/each}
      <DownloadItem task={sample("downloading")} selectedHash="downloading" onToggle={() => {}} />
      <DownloadItem task={sample("downloading")} removing onToggle={() => {}} />
    </div>
  </section>
</div>
