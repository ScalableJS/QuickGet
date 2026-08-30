<script lang="ts">
  import IconFolder from "~icons/lucide/folder";
  import RefreshCw from "~icons/lucide/refresh-cw";
  import { onDestroy } from "svelte";

  import type { DirEntry } from "@api/client.js";
  import type { Settings } from "@lib/config.js";
  import { getErrorMessage } from "@lib/errors.js";
  import { IconButton } from "@ui";

  import { getApiClient } from "../../shared/api";

  import { getTopLevelFolders } from "./folderCache.js";
  import { type FolderFieldStatus, validateFolder } from "./validateFolder.js";

  let {
    id,
    value = $bindable(""),
    placeholder = "",
    settings,
    status = $bindable<FolderFieldStatus>("idle"),
    formError,
  }: {
    id?: string;
    value: string;
    placeholder?: string;
    settings?: Settings;
    status?: FolderFieldStatus;
    /**
     * A form-level problem with this field — typically "required, and empty". Separate from
     * `status`, which reports what the NAS said about a path that was actually entered.
     */
    formError?: string;
  } = $props();

  // A field the form has rejected is invalid regardless of what folder validation thinks: it
  // has nothing to validate.
  const showsError = $derived(Boolean(formError) || status === "invalid");

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

<div class="folder-select relative flex gap-[var(--space-1)]">
  <div class="folder-input flex-1 min-w-0 relative">
    <input
      {id}
      type="text"
      role="combobox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-autocomplete="list"
      aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
      aria-describedby={showsError || status === "error" ? messageId : undefined}
      aria-invalid={showsError}
      aria-busy={status === "validating"}
      class={[
        "w-full h-[var(--control-height-md)] px-[var(--spacing-sm)] border border-solid border-transparent rounded-[var(--radius)] bg-[var(--textbox-bg)] text-[var(--textbox-text)] placeholder:text-[var(--textbox-placeholder)] text-13px transition-[background-color,border-color,box-shadow] duration-[var(--duration-fast)] hover:border-[var(--color-control-border)] focus:outline-none focus:border-[var(--color-primary-visual)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-focus-ring)_28%,transparent)]",
        status === "validating" && "pr-[var(--space-5)]",
        showsError && "!border-[var(--color-error)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-error)_25%,transparent)]",
        successFlash && "!border-[var(--color-success)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-success)_20%,transparent)]",
      ]}
      {placeholder}
      autocomplete="off"
      bind:value
      onfocus={focus}
      oninput={onInput}
      onkeydown={onKeydown}
      onblur={() => void validate()}
    />
    {#if status === "validating"}
      <span
        class="absolute top-1/2 right-[var(--space-2)] -translate-y-1/2 grid place-content-center pointer-events-none text-[var(--color-text-secondary)] animate-spin motion-reduce:animate-none [&>svg]:w-[14px] [&>svg]:h-[14px]"
        title="Checking folder…"
        aria-hidden="true"
      >
        <RefreshCw />
      </span>
    {/if}
  </div>
  <IconButton
    class="flex-none hover:bg-[var(--color-bg)] [&>svg]:w-[14px] [&>svg]:h-[14px]"
    title="Refresh folders from NAS"
    aria-label="Refresh folders from NAS"
    onclick={() => {
      open = true;
      void load(true);
    }}
  >
    <RefreshCw aria-hidden="true" />
  </IconButton>

  {#if open}
    <div
      class="absolute top-full left-0 right-0 z-30 mt-[var(--space-1)] max-h-[200px] overflow-y-auto bg-[var(--menu-bg)] border border-solid border-[var(--color-control-border)] rounded-[var(--radius-container)] shadow-[var(--shadow)] p-[var(--space-1)]"
      role="listbox"
      id={listboxId}
      tabindex="-1"
    >
      {#if loading}
        <p class="m-0 px-[var(--space-2)] py-[var(--space-1)] text-12px text-[var(--color-text-secondary)]">Loading…</p>
      {:else if error}
        <p class="m-0 px-[var(--space-2)] py-[var(--space-1)] text-12px text-[var(--color-error)]">{error}</p>
      {:else if filtered.length === 0}
        <p class="m-0 px-[var(--space-2)] py-[var(--space-1)] text-12px text-[var(--color-text-secondary)]">No matching folders — type a path manually.</p>
      {:else}
        {#each filtered as entry, i (entry.path)}
          <button
            type="button"
            id={optionId(i)}
            role="option"
            aria-selected={value === entry.path}
            class={[
              "flex items-center gap-[var(--space-2)] w-full text-left bg-transparent border-0 min-h-[var(--control-height)] px-[var(--space-2)] text-13px cursor-pointer rounded-[var(--radius)] transition-[background-color,color] duration-[var(--duration-fast)] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
              i === activeIndex && "bg-[var(--bg-hover)]",
              !entry.writtable && "text-[var(--text-muted)] cursor-not-allowed",
            ]}
            disabled={!entry.writtable}
            title={entry.writtable ? entry.path : `${entry.path} (read-only)`}
            onmouseover={() => (activeIndex = i)}
            onfocus={() => (activeIndex = i)}
            onclick={() => choose(entry)}
          >
            <IconFolder class="flex-none w-[14px] h-[14px] text-[var(--icon-folder)]" />
            <span>{entry.dir}{entry.writtable ? "" : " (read-only)"}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

{#if formError}
  <p id={messageId} class="mt-[var(--space-1)] mb-0 text-12px text-[var(--color-error)]" role="alert">{formError}</p>
{:else if status === "invalid"}
  <p id={messageId} class="mt-[var(--space-1)] mb-0 text-12px text-[var(--color-error)]" aria-live="polite">{statusReason}</p>
{:else if status === "error"}
  <p id={messageId} class="mt-[var(--space-1)] mb-0 text-12px text-[var(--color-warning)]" aria-live="polite">Couldn't verify folder ({statusReason})</p>
{/if}

<svelte:window onclick={(e) => {
  // Close when clicking outside this control.
  if (!(e.target instanceof Element) || !e.target.closest(".folder-select")) open = false;
}} />
