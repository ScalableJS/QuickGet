<script lang="ts" generics="Id extends string">
  import type { Snippet } from "svelte";

  /**
   * Generic ARIA tabs (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). Panels stay mounted and
   * are only visually hidden, not `{#if}`-removed, so switching tabs never drops form state or
   * in-progress validation — the caller decides what "hidden" means for its own content.
   */
  type Tab = { id: Id; label: string };
  type Props = {
    tabs: Tab[];
    active: Id;
    onActivate: (id: Id) => void;
    panels: Snippet<[Tab]>;
  };

  let { tabs, active, onActivate, panels }: Props = $props();

  function onKeydown(event: KeyboardEvent): void {
    const index = tabs.findIndex((tab) => tab.id === active);
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const next = tabs[nextIndex];
    onActivate(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }
</script>

<div class="flex gap-[var(--space-1)] border-b border-b-[var(--color-control-border)] mb-[var(--space-3)]" role="tablist" tabindex="-1" onkeydown={onKeydown}>
  {#each tabs as tab (tab.id)}
    <button
      type="button"
      id={`tab-${tab.id}`}
      role="tab"
      aria-selected={tab.id === active}
      aria-controls={`panel-${tab.id}`}
      tabindex={tab.id === active ? 0 : -1}
      class={[
        "flex-1 min-w-0 px-[var(--space-1)] py-[var(--space-2)] border-0 border-b-2 bg-transparent text-12px font-600 cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis hover:text-[var(--color-text)]",
        tab.id === active
          ? "text-[var(--color-primary)] border-b-[var(--color-primary)]"
          : "text-[var(--text-secondary)] border-b-transparent",
      ]}
      onclick={() => onActivate(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>

{#each tabs as tab (tab.id)}
  <div id={`panel-${tab.id}`} role="tabpanel" aria-labelledby={`tab-${tab.id}`} tabindex="0" hidden={tab.id !== active} class={tab.id !== active ? "hidden" : undefined}>
    {@render panels(tab)}
  </div>
{/each}
