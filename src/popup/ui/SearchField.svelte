<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  import type { ControlSize } from "./controlSize.js";

  type Props = {
    value?: string;
    size?: ControlSize;
  } & Omit<HTMLInputAttributes, "size" | "value" | "type">;

  const sizeClasses = {
    sm: "h-[var(--control-height-sm)] text-12px",
    md: "h-[var(--control-height-md)] text-13px",
  } satisfies Record<ControlSize, string>;

  let { value = $bindable(""), size = "md", class: klass, ...rest }: Props = $props();
</script>

<div class="relative w-full">
  <input
    type="search"
    class={[
      "w-full box-border pl-[var(--spacing-sm)] pr-[calc(var(--spacing-sm)+18px)] py-0 border border-solid border-transparent rounded-[var(--radius)] bg-[var(--textbox-bg)] text-[var(--color-text)] transition-[background-color,border-color,box-shadow] duration-[var(--duration-fast)] hover:border-[var(--color-control-border)] focus:outline-none focus:border-[var(--color-primary-visual)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-focus-ring)_28%,transparent)] [&::-webkit-search-cancel-button]:appearance-none",
      sizeClasses[size],
      klass,
    ]}
    bind:value
    {...rest}
  />
  {#if value}
    <button
      type="button"
      class="absolute top-1/2 right-[6px] -translate-y-1/2 rounded-[4px] border-0 bg-transparent text-[var(--color-text-secondary)] text-16px leading-none cursor-pointer px-[2px] py-0 transition-[background-color,color] duration-[var(--duration-fast)] hover:bg-[var(--bg-hover)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      aria-label="Clear search"
      onclick={() => (value = "")}
    >
      ×
    </button>
  {/if}
</div>
