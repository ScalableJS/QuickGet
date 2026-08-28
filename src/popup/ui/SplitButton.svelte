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

<div class="split-btn relative inline-flex" role="group" aria-label={primaryLabel}>
  <IconButton
    {id}
    {size}
    class="rounded-r-0"
    title={primaryLabel}
    aria-label={primaryLabel}
    {disabled}
    onclick={onPrimary}
  >
    {@render primaryIcon()}
  </IconButton>
  <IconButton
    {size}
    class="rounded-l-0 border-l border-l-[color-mix(in_srgb,var(--color-control-border)_60%,transparent)] px-[var(--space-1)]"
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
    <div
      class="absolute top-full right-0 z-20 mt-[var(--space-1)] min-w-[180px] bg-[var(--menu-bg)] border border-[var(--color-control-border)] rounded-[var(--radius)] shadow-[var(--shadow)] p-[var(--space-1)] flex flex-col"
      role="menu"
      tabindex="-1"
      aria-label={menuLabel}
      onkeydown={onMenuKeydown}
    >
      {#each items as item, i (item.label)}
        <button
          type="button"
          role="menuitem"
          class="flex items-center gap-[var(--space-2)] min-h-[var(--control-height)] px-[var(--space-2)] py-0 border-0 bg-transparent text-[var(--menu-text)] text-left text-13px cursor-pointer rounded-[var(--radius)] hover:bg-[var(--color-bg-alt)] focus-visible:bg-[var(--color-bg-alt)] focus-visible:outline-none"
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
