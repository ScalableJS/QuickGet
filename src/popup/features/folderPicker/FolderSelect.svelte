<script lang="ts">
  import IconFolder from "~icons/lucide/folder";
  import RefreshCw from "~icons/lucide/refresh-cw";
  import { onDestroy } from "svelte";

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

  // Index of the keyboard-highlighted option in `filtered` (-1 = none).
  let activeIndex = $state(-1);
  const listboxId = $derived(id ? `${id}-listbox` : "folder-listbox");
  const messageId = $derived(id ? `${id}-message` : undefined);
  const optionId = (i: number): string => `${listboxId}-opt-${i}`;

  let statusReason = $state("");
  let successFlash = $state(false);
  let successTimer: ReturnType<typeof setTimeout> | undefined;
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
    clearSuccess();
    const result = await validateFolder(value, listDirFor);
    if (token !== validateToken) return; // a newer validate() superseded this one
    status = result.status;
    statusReason = result.reason ?? "";
    if (result.status === "valid") showSuccess();
    else clearSuccess();
  }

  function showSuccess(): void {
    if (successTimer) clearTimeout(successTimer);
    successFlash = true;
    successTimer = setTimeout(() => {
      successFlash = false;
      successTimer = undefined;
    }, 1800);
  }

  function clearSuccess(): void {
    if (successTimer) clearTimeout(successTimer);
    successTimer = undefined;
    successFlash = false;
  }

  onDestroy(clearSuccess);

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
    activeIndex = -1;
    // It came from the writable listing — known-good, no need to re-query.
    validateToken++;
    status = "valid";
    statusReason = "";
    showSuccess();
  }

  function onInput(): void {
    open = true;
    // The filtered list just changed under us — drop the stale highlight.
    activeIndex = -1;
    // Clear any stale verdict while the user is editing.
    validateToken++;
    status = "idle";
    statusReason = "";
    clearSuccess();
  }

  // Skip read-only entries when moving the highlight with the keyboard.
  function nextSelectable(from: number, step: 1 | -1): number {
    for (let i = from; i >= 0 && i < filtered.length; i += step) {
      if (filtered[i].writtable) return i;
    }
    return -1;
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        open = true;
        if (!loaded && !loading) void load();
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      const start = activeIndex < 0 ? (step === 1 ? 0 : filtered.length - 1) : activeIndex + step;
      const next = nextSelectable(start, step);
      if (next !== -1) activeIndex = next;
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0 && filtered[activeIndex]) {
        e.preventDefault();
        choose(filtered[activeIndex]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        open = false;
        activeIndex = -1;
      }
    }
  }
</script>

<div class="folder-select">
  <div class="folder-input" class:is-invalid={status === "invalid"} class:success-flash={successFlash}>
    <input
      {id}
      type="text"
      role="combobox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-autocomplete="list"
      aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
      aria-describedby={status === "invalid" || status === "error" ? messageId : undefined}
      aria-invalid={status === "invalid"}
      aria-busy={status === "validating"}
      class:has-spinner={status === "validating"}
      {placeholder}
      autocomplete="off"
      bind:value
      onfocus={focus}
      oninput={onInput}
      onkeydown={onKeydown}
      onblur={() => void validate()}
    />
    {#if status === "validating"}
      <span class="status-icon validating" title="Checking folder…" aria-hidden="true"><RefreshCw /></span>
    {/if}
  </div>
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
    <RefreshCw aria-hidden="true" />
  </button>

  {#if open}
    <div class="dropdown" role="listbox" id={listboxId} tabindex="-1">
      {#if loading}
        <p class="ds-note">Loading…</p>
      {:else if error}
        <p class="ds-error">{error}</p>
      {:else if filtered.length === 0}
        <p class="ds-note">No matching folders — type a path manually.</p>
      {:else}
        {#each filtered as entry, i (entry.path)}
          <button
            type="button"
            id={optionId(i)}
            role="option"
            aria-selected={value === entry.path}
            class="ds-option"
            class:readonly={!entry.writtable}
            class:active={i === activeIndex}
            disabled={!entry.writtable}
            title={entry.writtable ? entry.path : `${entry.path} (read-only)`}
            onmouseover={() => (activeIndex = i)}
            onfocus={() => (activeIndex = i)}
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
  <p id={messageId} class="field-msg error" aria-live="polite">{statusReason}</p>
{:else if status === "error"}
  <p id={messageId} class="field-msg unverified" aria-live="polite">Couldn't verify folder ({statusReason})</p>
{/if}

<svelte:window onclick={(e) => {
  // Close when clicking outside this control.
  if (!(e.target instanceof Element) || !e.target.closest(".folder-select")) open = false;
}} />

<style>
  .folder-select {
    position: relative;
    display: flex;
    gap: var(--space-1);
    align-items: stretch;
  }

  .folder-input {
    flex: 1;
    min-width: 0;
    position: relative;
  }

  .folder-input input {
    width: 100%;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .folder-input input.has-spinner {
    padding-right: var(--space-5);
  }

  .folder-input.is-invalid input {
    border-color: var(--color-error);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-error) 25%, transparent);
  }

  .folder-input.success-flash input {
    border-color: var(--color-success);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-success) 20%, transparent);
  }

  .status-icon {
    position: absolute;
    top: 50%;
    right: var(--space-2);
    display: grid;
    place-content: center;
    transform: translateY(-50%);
    pointer-events: none;
  }

  .status-icon :global(svg),
  .refresh :global(svg) {
    width: 14px;
    height: 14px;
  }

  .status-icon.validating {
    color: var(--color-text-secondary);
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
    margin: var(--space-1) 0 0;
    font-size: 12px;
  }

  .field-msg.error {
    color: var(--color-error);
  }

  .field-msg.unverified {
    color: var(--color-warning);
  }

  .refresh {
    flex-shrink: 0;
    border: 1px solid var(--color-control-border);
    background: var(--color-bg-alt);
    color: var(--color-text);
    border-radius: var(--radius);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-2);
    font-size: 14px;
    line-height: 1;
  }

  .refresh:hover {
    background: var(--color-bg);
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 30;
    margin-top: var(--space-1);
    max-height: 200px;
    overflow-y: auto;
    background: var(--menu-bg);
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: var(--space-1);
  }

  .ds-option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    min-height: var(--control-height);
    padding: 0 var(--space-2);
    font-size: 13px;
    cursor: pointer;
    border-radius: var(--radius);
  }

  .ds-option :global(.ds-folder-icon) {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    color: var(--icon-folder);
  }

  .ds-option:hover,
  .ds-option.active {
    background: var(--color-bg);
  }

  .ds-option.readonly {
    color: var(--text-muted);
    cursor: not-allowed;
  }

  .ds-note {
    margin: 0;
    padding: var(--space-1) var(--space-2);
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .ds-error {
    margin: 0;
    padding: var(--space-1) var(--space-2);
    font-size: 12px;
    color: var(--color-error);
  }
</style>
