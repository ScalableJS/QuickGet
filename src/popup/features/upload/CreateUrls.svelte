<script lang="ts">
  import { DEFAULTS } from "@lib/config.js";
  import { loadSettings } from "@lib/settings.js";
  import { Alert, Badge, Button } from "@ui";

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
        <Badge variant="accent" title={urls.join("\n")}>{urls.length}</Badge>
      {/if}
    </label>
    <textarea
      id="batch-urls"
      rows="4"
      placeholder={"https://example.com/a.zip\nmagnet:?xt=...\nEach line becomes one task"}
      bind:value={raw}
    ></textarea>
    <Alert tone="hint">Each line is treated as an individual URL and creates a task.</Alert>
  </div>

  <div class="field">
    <label for="batch-folder">Target Folder</label>
    <FolderSelect id="batch-folder" placeholder="/share/Multimedia/Movies" bind:value={targetFolder} />
  </div>

  <Button disabled={submitting || urls.length === 0} onclick={create}>
    {submitting ? "Adding…" : `Create ${urls.length || ""} task(s)`}
  </Button>
</div>

<style>
  .create-urls {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field label {
    font-size: 13px;
    font-weight: 600;
  }

  textarea {
    resize: vertical;
  }
</style>
