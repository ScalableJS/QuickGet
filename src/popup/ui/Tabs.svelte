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

<div class="tabs" role="tablist" tabindex="-1" onkeydown={onKeydown}>
  {#each tabs as tab (tab.id)}
    <button
      type="button"
      id={`tab-${tab.id}`}
      role="tab"
      aria-selected={tab.id === active}
      aria-controls={`panel-${tab.id}`}
      tabindex={tab.id === active ? 0 : -1}
      class="tab"
      class:active={tab.id === active}
      onclick={() => onActivate(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>

{#each tabs as tab (tab.id)}
  <div id={`panel-${tab.id}`} role="tabpanel" aria-labelledby={`tab-${tab.id}`} tabindex="0" hidden={tab.id !== active} class="tab-panel">
    {@render panels(tab)}
  </div>
{/each}

<style>
  .tabs {
    display: flex;
    gap: var(--space-1);
    border-bottom: 1px solid var(--color-control-border);
    margin-bottom: var(--space-3);
  }

  .tab {
    flex: 1;
    min-width: 0;
    padding: var(--space-2) var(--space-1);
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab:hover {
    color: var(--color-text);
  }

  .tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  /* [hidden] already removes the panel from the a11y tree and layout; nothing extra needed. */
  .tab-panel[hidden] {
    display: none;
  }
</style>
