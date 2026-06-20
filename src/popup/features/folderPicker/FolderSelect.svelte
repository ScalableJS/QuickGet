<script lang="ts">
  import IconFolder from "~icons/lucide/folder";

  import type { DirEntry } from "@api/client.js";
  import type { Settings } from "@lib/config.js";
  import { getErrorMessage } from "@lib/errors.js";

  import { getApiClient } from "../../shared/api";

  import { getTopLevelFolders } from "./folderCache.js";
  import { type FolderFieldStatus, validateFolder } from "./validateFolder.js";

  let {
    id,
    value = $bindable(""),
    placeholder = "",
    settings,
    status = $bindable<FolderFieldStatus>("idle"),
  }: {
    id?: string;
    value: string;
    placeholder?: string;
    settings?: Settings;
    status?: FolderFieldStatus;
  } = $props();

  let open = $state(false);
  let entries = $state<DirEntry[]>([]);
  let loaded = $state(false);
  let loading = $state(false);
  let error = $state("");

  let statusReason = $state("");
  // Monotonic token so a slow validate() can't overwrite a newer one (race guard).
  let validateToken = 0;

  async function listDirFor(path: string): Promise<DirEntry[]> {
    const client = await getApiClient(settings ? { settings } : undefined);
    return client.listDir(path);
  }

  async function validate(): Promise<void> {
    if (!value.trim()) {
      // Empty field — neutral, no indicator. Settings gates "required" separately.
      validateToken++;
      status = "idle";
      statusReason = "";
      return;
    }
    const token = ++validateToken;
    status = "validating";
    statusReason = "";
    const result = await validateFolder(value, listDirFor);
    if (token !== validateToken) return; // a newer validate() superseded this one
    status = result.status;
    statusReason = result.reason ?? "";
  }

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
    // It came from the writable listing — known-good, no need to re-query.
    validateToken++;
    status = "valid";
    statusReason = "";
  }

  function onInput(): void {
    open = true;
    // Clear any stale verdict while the user is editing.
    validateToken++;
    status = "idle";
    statusReason = "";
  }
</script>

<div class="folder-select">
  <input
    {id}
    type="text"
    class:is-invalid={status === "invalid"}
    aria-invalid={status === "invalid"}
    {placeholder}
    autocomplete="off"
    bind:value
    onfocus={focus}
    oninput={onInput}
    onblur={() => void validate()}
  />
  {#if status === "validating"}
    <span class="status-icon validating" title="Checking folder…" aria-hidden="true">⟳</span>
  {:else if status === "valid"}
    <span class="status-icon valid" title="Folder exists and is writable" aria-hidden="true">✓</span>
  {:else if status === "invalid"}
    <span class="status-icon invalid" title={statusReason} aria-hidden="true">✕</span>
  {:else if status === "error"}
    <span class="status-icon unverified" title={statusReason} aria-hidden="true">⚠</span>
  {/if}
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

{#if status === "invalid"}
  <p class="field-msg error" aria-live="polite">{statusReason}</p>
{:else if status === "error"}
  <p class="field-msg unverified" aria-live="polite">Couldn't verify ({statusReason})</p>
{/if}

<svelte:window onclick={(e) => {
  // Close when clicking outside this control.
  if (!(e.target instanceof Element) || !e.target.closest(".folder-select")) open = false;
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

  .folder-select input.is-invalid {
    border-color: #d32f2f;
    box-shadow: 0 0 0 2px rgba(211, 47, 47, 0.25);
  }

  .status-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 0 2px;
    font-size: 14px;
    line-height: 1;
  }

  .status-icon.valid {
    color: #2e7d32;
  }

  .status-icon.invalid {
    color: #d32f2f;
  }

  .status-icon.unverified {
    color: #b8860b;
  }

  .status-icon.validating {
    color: #777;
    animation: folder-spin 1s linear infinite;
  }

  @keyframes folder-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .status-icon.validating {
      animation: none;
    }
  }

  .field-msg {
    margin: 4px 0 0;
    font-size: 12px;
  }

  .field-msg.error {
    color: #d32f2f;
  }

  .field-msg.unverified {
    color: #b8860b;
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
