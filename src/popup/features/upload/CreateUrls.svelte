<script lang="ts">
  import { DEFAULTS } from "@lib/config.js";
  import { loadSettings } from "@lib/settings.js";

  import FolderSelect from "../folderPicker/FolderSelect.svelte";

  import { parseUrlLines, uploadUrls } from "./batchUpload.js";

  let { onSuccess }: { onSuccess?: () => void } = $props();

  let raw = $state("");
  let targetFolder = $state(DEFAULTS.NASdir);
  let submitting = $state(false);

  const urls = $derived(parseUrlLines(raw));

  // Seed the destination with the user's configured target folder.
  void loadSettings().then((settings) => {
    targetFolder = settings.NASdir;
  });

  async function create(): Promise<void> {
    submitting = true;
    try {
      await uploadUrls(urls, {
        targetFolder: targetFolder.trim() || undefined,
        onSuccess: () => {
          raw = "";
          onSuccess?.();
        },
      });
    } finally {
      submitting = false;
    }
  }
</script>

<div class="create-urls">
  <div class="field">
    <label for="batch-urls">
      URLs
      {#if urls.length > 0}
        <span class="chip" title={urls.join("\n")}>{urls.length}</span>
      {/if}
    </label>
    <textarea
      id="batch-urls"
      rows="4"
      placeholder={"https://example.com/a.zip\nmagnet:?xt=...\nEach line becomes one task"}
      bind:value={raw}
    ></textarea>
    <p class="hint">Each line is treated as an individual URL and creates a task.</p>
  </div>

  <div class="field">
    <label for="batch-folder">Target Folder</label>
    <FolderSelect id="batch-folder" placeholder="/share/Multimedia/Movies" bind:value={targetFolder} />
  </div>

  <button type="button" class="btn btn-primary" disabled={submitting || urls.length === 0} onclick={create}>
    {submitting ? "Adding…" : `Create ${urls.length || ""} task(s)`}
  </button>
</div>

<style>
  .create-urls {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field label {
    font-size: 13px;
    font-weight: 600;
  }

  .chip {
    display: inline-block;
    margin-left: 4px;
    padding: 0 6px;
    border-radius: 10px;
    background: #2196f3;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
  }

  .hint {
    margin: 0;
    font-size: 11px;
    color: #777;
  }

  textarea {
    resize: vertical;
  }
</style>
