<script lang="ts">
  import ChevronDown from "~icons/lucide/chevron-down";

  import type { Snippet } from "svelte";
  import type { HTMLSelectAttributes } from "svelte/elements";

  import type { ControlSize } from "./controlSize.js";

  type Props = {
    id?: string;
    label?: string;
    value?: string;
    size?: ControlSize;
    children: Snippet;
  } & Omit<HTMLSelectAttributes, "size" | "value">;

  const sizeClasses = {
    sm: "h-[var(--control-height-sm)] text-12px",
    md: "h-[var(--control-height-md)] text-13px",
  } satisfies Record<ControlSize, string>;

  let { id, label, value = $bindable(""), size = "md", class: klass, children, ...rest }: Props = $props();
</script>

<div class="relative block">
  {#if label}
    <label for={id} class="block font-500 mb-[var(--spacing-sm)] text-[var(--color-text)]">{label}</label>
  {/if}
  <div class="relative">
    <select
      {id}
      class={[
        "w-full appearance-none pl-[var(--spacing-sm)] pr-[var(--space-6)] py-0 border border-[var(--color-control-border)] rounded-[var(--radius)] bg-[var(--textbox-bg)] text-[var(--textbox-text)] cursor-pointer transition-[border-color] duration-200 focus:outline-none focus:border-[var(--color-primary-visual)] focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]",
        sizeClasses[size],
        klass,
      ]}
      bind:value
      {...rest}
    >
      {@render children()}
    </select>
    <span class="absolute right-[var(--space-3)] top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] pointer-events-none flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4" aria-hidden="true">
      <ChevronDown />
    </span>
  </div>
</div>
