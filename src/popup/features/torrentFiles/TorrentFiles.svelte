<script lang="ts">
  import type { TorrentFile } from "@api/client.js";
  import { showStatus } from "@/popup/components";
  import { getErrorMessage } from "@lib/errors.js";

  import { getTorrentFiles, setTorrentFiles } from "../downloads/downloadsManager.js";

  let { hash }: { hash: string } = $props();

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
      files = await getTorrentFiles(hash);
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
        .map((f) => ({ index: f.no, priority: (wanted[f.no] ? 1 : 0) as 0 | 1 }));

      if (selections.length === 0) {
        showStatus("No changes to apply", "info", { autoHideMs: 1500 });
        return;
      }

      const results = await setTorrentFiles(hash, selections);
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

<div class="torrent-files">
  {#if loading}
    <p class="tf-note">Loading files…</p>
  {:else if error}
    <p class="tf-error">{error}</p>
  {:else if files.length === 0}
    <p class="tf-note">No files reported for this task.</p>
  {:else}
    <ul class="tf-list">
      {#each shown as file (file.no)}
        <li>
          <label>
            <input type="checkbox" bind:checked={wanted[file.no]} />
            <span class="tf-name" title={file.filename}>{file.filename}</span>
            <span class="tf-size">{formatSize(file.size)}</span>
          </label>
        </li>
      {/each}
    </ul>

    {#if files.length > DISPLAY_LIMIT}
      <p class="tf-note">
        Showing first {DISPLAY_LIMIT} of {files.length} files — manage the rest in the QTS interface.
      </p>
    {/if}

    <div class="tf-actions">
      <span class="tf-count">{selectedCount} selected</span>
      <button type="button" class="btn btn-primary" disabled={saving} onclick={save}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  {/if}
</div>

<style>
  .torrent-files {
    margin-top: 6px;
    padding: 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: #fafafa;
  }

  .tf-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 180px;
    overflow-y: auto;
  }

  .tf-list li label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
    font-size: 12px;
    cursor: pointer;
  }

  .tf-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tf-size {
    color: #777;
    flex-shrink: 0;
  }

  .tf-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }

  .tf-count {
    font-size: 12px;
    color: #555;
  }

  .tf-note {
    margin: 4px 0;
    font-size: 12px;
    color: #777;
  }

  .tf-error {
    margin: 4px 0;
    font-size: 12px;
    color: #d32f2f;
  }
</style>
