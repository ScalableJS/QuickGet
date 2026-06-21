<script lang="ts">
  import type { Snippet } from "svelte";
  import IconChevronDown from "~icons/lucide/chevron-down";

  import IconButton from "./IconButton.svelte";
  import type { ControlSize } from "./controlSize.js";

  type MenuItem = { label: string; icon?: Snippet; onSelect: () => void };

  type Props = {
    /** Primary (left) button: label, icon, action. */
    primaryLabel: string;
    primaryIcon: Snippet;
    onPrimary: () => void;
    /** Menu (right caret) items. */
    items: MenuItem[];
    menuLabel?: string;
    id?: string;
    size?: ControlSize;
    disabled?: boolean;
  };

  let {
    primaryLabel,
    primaryIcon,
    onPrimary,
    items,
    menuLabel = "More options",
    id,
    size = "sm",
    disabled = false,
  }: Props = $props();

  let open = $state(false);
  let caretEl = $state<HTMLButtonElement>();
  let itemEls = $state<HTMLElement[]>([]);
  let activeIndex = $state(0);

  function openMenu(): void {
    open = true;
    activeIndex = 0;
    queueMicrotask(() => itemEls[0]?.focus());
  }

  function closeMenu(focusCaret = true): void {
    open = false;
    if (focusCaret) caretEl?.focus();
  }

  function pick(item: MenuItem): void {
    closeMenu(false);
    item.onSelect();
  }

  function onMenuKeydown(e: KeyboardEvent): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      itemEls[activeIndex]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      itemEls[activeIndex]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      closeMenu();
    } else if (e.key === "Home") {
      e.preventDefault();
      activeIndex = 0;
      itemEls[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      activeIndex = items.length - 1;
      itemEls[activeIndex]?.focus();
    }
  }
</script>

<svelte:window
  onclick={(e) => {
    if (open && e.target instanceof Element && !e.target.closest(".split-btn")) closeMenu(false);
  }}
/>

<div class="split-btn" role="group" aria-label={primaryLabel}>
  <IconButton {id} {size} class="split-primary" title={primaryLabel} aria-label={primaryLabel} {disabled} onclick={onPrimary}>
    {@render primaryIcon()}
  </IconButton>
  <IconButton
    {size}
    class="split-caret"
    title={menuLabel}
    aria-label={menuLabel}
    aria-haspopup="menu"
    aria-expanded={open}
    {disabled}
    bind:el={caretEl}
    onclick={(e) => {
      e.stopPropagation();
      open ? closeMenu(false) : openMenu();
    }}
  >
    <IconChevronDown />
  </IconButton>

  {#if open}
    <div class="menu" role="menu" tabindex="-1" aria-label={menuLabel} onkeydown={onMenuKeydown}>
      {#each items as item, i (item.label)}
        <button
          type="button"
          role="menuitem"
          class="menu-item"
          tabindex={i === activeIndex ? 0 : -1}
          bind:this={itemEls[i]}
          onclick={() => pick(item)}
        >
          {#if item.icon}{@render item.icon()}{/if}
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .split-btn {
    position: relative;
    display: inline-flex;
    align-items: stretch;
  }

  .split-btn :global(.split-primary) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .split-btn :global(.split-caret) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-left: 1px solid color-mix(in srgb, var(--color-control-border) 60%, transparent);
    padding-left: var(--space-1);
    padding-right: var(--space-1);
  }

  .menu {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 20;
    margin-top: var(--space-1);
    min-width: 180px;
    background: var(--menu-bg);
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: var(--space-1);
    display: flex;
    flex-direction: column;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--control-height);
    padding: 0 var(--space-2);
    border: none;
    background: none;
    color: var(--menu-text);
    text-align: left;
    font-size: 13px;
    cursor: pointer;
    border-radius: var(--radius);
  }

  .menu-item:hover,
  .menu-item:focus-visible {
    background: var(--color-bg-alt);
    outline: none;
  }
</style>
