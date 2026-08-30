<script lang="ts">
  import type { TorrentFile } from "@api/client.js";
  import { showStatus } from "@/popup/components";
  import { getErrorMessage } from "@lib/errors.js";
  import { Button, Checkbox } from "@ui";

  import { getTorrentFiles, setTorrentFiles } from "../downloads/downloadsManager.js";

  type FileSelection = { index: number; priority: 0 | 1 };
  type SaveResult = { index: number; ok: boolean; error?: string };

  let {
    hash,
    loadFiles = getTorrentFiles,
    saveFiles = setTorrentFiles,
  }: {
    hash: string;
    loadFiles?: (hash: string) => Promise<TorrentFile[]>;
    saveFiles?: (hash: string, selections: FileSelection[]) => Promise<SaveResult[]>;
  } = $props();

  const DISPLAY_LIMIT = 100;

  let files = $state<TorrentFile[]>([]);
  // index -> wanted (priority 1). Mirrors the server's current priority.
  let wanted = $state<Record<number, boolean>>({});
  let loading = $state(true);
  let saving = $state(false);
  let error = $state("");

  const shown = $derived(files.slice(0, DISPLAY_LIMIT));
  const selectedCount = $derived(Object.values(wanted).filter(Boolean).length);

  async function load(): Promise<void> {
    loading = true;
    error = "";
    try {
      files = await loadFiles(hash);
      wanted = Object.fromEntries(files.map((f) => [f.no, f.priority === 1]));
    } catch (err) {
      error = getErrorMessage(err);
    } finally {
      loading = false;
    }
  }

  async function save(): Promise<void> {
    if (selectedCount === 0) {
      showStatus("Select at least one file", "error");
      return;
    }
    saving = true;
    try {
      // Only send files whose wanted-state changed from the server's value.
      const selections = files
        .filter((f) => (f.priority === 1) !== wanted[f.no])
        .map(
          (f): FileSelection => ({
            index: f.no,
            priority: wanted[f.no] ? 1 : 0,
          }),
        );

      if (selections.length === 0) {
        showStatus("No changes to apply", "info", { autoHideMs: 1500 });
        return;
      }

      const results = await saveFiles(hash, selections);
      const failed = results.filter((r) => !r.ok).length;
      if (failed === 0) {
        showStatus(`Updated ${results.length} file(s)`, "success", { autoHideMs: 2000 });
      } else {
        showStatus(`Updated ${results.length - failed}, failed ${failed}`, "error");
      }
    } catch (err) {
      showStatus(`Error: ${getErrorMessage(err)}`, "error");
    } finally {
      saving = false;
    }
  }

  void load();

  function formatSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let v = bytes;
    let u = 0;
    while (v >= 1024 && u < units.length - 1) {
      v /= 1024;
      u += 1;
    }
    return `${v.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
  }
</script>

<div class="torrent-files mt-[6px] p-2 rounded-[var(--radius)] bg-[var(--color-bg-alt)]">
  {#if loading}
    <p class="tf-note my-1 text-12px text-[var(--color-text-secondary)]">Loading files…</p>
  {:else if error}
    <p class="tf-error my-1 text-12px text-[var(--color-error)]">{error}</p>
  {:else if files.length === 0}
    <p class="tf-note my-1 text-12px text-[var(--color-text-secondary)]">No files reported for this task.</p>
  {:else}
    <ul class="tf-list list-none m-0 p-0 max-h-[180px] overflow-y-auto">
      {#each shown as file (file.no)}
        <li class="py-[3px] text-12px">
          <Checkbox bind:checked={wanted[file.no]}>
            <span class="tf-name flex-1 overflow-hidden text-ellipsis whitespace-nowrap" title={file.filename}>{file.filename}</span>
            <span class="tf-size text-[var(--color-text-secondary)] flex-none">{formatSize(file.size)}</span>
          </Checkbox>
        </li>
      {/each}
    </ul>

    {#if files.length > DISPLAY_LIMIT}
      <p class="tf-note my-1 text-12px text-[var(--color-text-secondary)]">
        Showing first {DISPLAY_LIMIT} of {files.length} files — manage the rest in the QTS interface.
      </p>
    {/if}

    <div class="tf-actions flex items-center justify-between gap-[var(--space-3)] mt-2">
      <span class="tf-count text-12px text-[var(--color-text)]">{selectedCount} selected</span>
      <Button disabled={saving} onclick={save}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  {/if}
</div>
