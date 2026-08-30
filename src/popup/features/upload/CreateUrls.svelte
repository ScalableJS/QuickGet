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

<div class="create-urls flex flex-col gap-[var(--space-3)] p-[var(--space-3)]">
  <div class="flex flex-col gap-[var(--space-1)]">
    <label for="batch-urls" class="text-13px font-600 text-[var(--color-text)]">
      URLs
      {#if urls.length > 0}
        <Badge variant="accent" title={urls.join("\n")}>{urls.length}</Badge>
      {/if}
    </label>
    <textarea
      id="batch-urls"
      rows="4"
      placeholder={"https://example.com/a.zip\nmagnet:?xt=...\nEach line becomes one task"}
      class="w-full min-h-[var(--control-height)] p-[var(--spacing-sm)] border border-solid border-transparent rounded-[var(--radius)] text-13px bg-[var(--textbox-bg)] text-[var(--textbox-text)] placeholder:text-[var(--textbox-placeholder)] resize-y transition-[background-color,border-color,box-shadow] duration-[var(--duration-fast)] hover:border-[var(--color-control-border)] focus:outline-none focus:border-[var(--color-primary-visual)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-focus-ring)_28%,transparent)]"
      bind:value={raw}
    ></textarea>
    <Alert tone="hint">Each line is treated as an individual URL and creates a task.</Alert>
  </div>

  <div class="flex flex-col gap-[var(--space-1)]">
    <label for="batch-folder" class="text-13px font-600 text-[var(--color-text)]">Target Folder</label>
    <FolderSelect id="batch-folder" placeholder="/share/Multimedia/Movies" bind:value={targetFolder} />
  </div>

  <Button disabled={submitting || urls.length === 0} onclick={create}>
    {submitting ? "Adding…" : `Create ${urls.length || ""} task(s)`}
  </Button>
</div>
