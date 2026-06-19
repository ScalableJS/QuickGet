<script lang="ts">
  import IconFolder from "~icons/lucide/folder";

  import type { DirEntry } from "@api/client.js";
  import type { Settings } from "@lib/config.js";
  import { getErrorMessage } from "@lib/errors.js";

  import { getTopLevelFolders } from "./folderCache.js";

  let {
    id,
    value = $bindable(""),
    placeholder = "",
    settings,
  }: {
    id?: string;
    value: string;
    placeholder?: string;
    settings?: Settings;
  } = $props();

  let open = $state(false);
  let entries = $state<DirEntry[]>([]);
  let loaded = $state(false);
  let loading = $state(false);
  let error = $state("");

  // Filter the cached top-level folders by what the user has typed.
  const filtered = $derived(
    entries.filter((e) => e.dir.toLowerCase().includes(value.trim().toLowerCase())),
  );

  async function load(force = false): Promise<void> {
    loading = true;
    error = "";
    try {
      entries = await getTopLevelFolders(settings, force);
      loaded = true;
    } catch (err) {
      error = getErrorMessage(err);
    } finally {
      loading = false;
    }
  }

  function focus(): void {
    open = true;
    if (!loaded && !loading) void load();
  }

  function choose(entry: DirEntry): void {
    if (!entry.writtable) return;
    value = entry.path;
    open = false;
  }
</script>

<div class="folder-select">
  <input
    {id}
    type="text"
    {placeholder}
    autocomplete="off"
    bind:value
    onfocus={focus}
    oninput={() => (open = true)}
  />
  <button
    type="button"
    class="refresh"
    title="Refresh folders from NAS"
    aria-label="Refresh folders from NAS"
    onclick={() => {
      open = true;
      void load(true);
    }}
  >
    ⟳
  </button>

  {#if open}
    <div class="dropdown" role="listbox" tabindex="-1">
      {#if loading}
        <p class="ds-note">Loading…</p>
      {:else if error}
        <p class="ds-error">{error}</p>
      {:else if filtered.length === 0}
        <p class="ds-note">No matching folders — type a path manually.</p>
      {:else}
        {#each filtered as entry (entry.path)}
          <button
            type="button"
            role="option"
            aria-selected={value === entry.path}
            class="ds-option"
            class:readonly={!entry.writtable}
            disabled={!entry.writtable}
            title={entry.writtable ? entry.path : `${entry.path} (read-only)`}
            onclick={() => choose(entry)}
          >
            <IconFolder class="ds-folder-icon" />
            <span>{entry.dir}{entry.writtable ? "" : " (read-only)"}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<svelte:window onclick={(e) => {
  // Close when clicking outside this control.
  if (!(e.target instanceof Element) || !e.target.closest(`.folder-select`)) open = false;
}} />

<style>
  .folder-select {
    position: relative;
    display: flex;
    gap: 4px;
    align-items: stretch;
  }

  .folder-select input {
    flex: 1;
  }

  .refresh {
    flex-shrink: 0;
    border: 1px solid #d0d0d0;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
    padding: 0 8px;
    font-size: 14px;
    line-height: 1;
  }

  .refresh:hover {
    background: #f0f0f0;
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 30;
    margin-top: 2px;
    max-height: 200px;
    overflow-y: auto;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 4px;
  }

  .ds-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 5px 8px;
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
  }

  .ds-option :global(.ds-folder-icon) {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    color: #f5b301;
  }

  .ds-option:hover {
    background: #f0f0f0;
  }

  .ds-option.readonly {
    color: #aaa;
    cursor: not-allowed;
  }

  .ds-note {
    margin: 0;
    padding: 4px 8px;
    font-size: 12px;
    color: #777;
  }

  .ds-error {
    margin: 0;
    padding: 4px 8px;
    font-size: 12px;
    color: #d32f2f;
  }
</style>
