<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  import type { ControlSize } from "./controlSize.js";

  type Props = {
    el?: HTMLButtonElement;
    size?: ControlSize;
    children: Snippet;
  } & HTMLButtonAttributes;

  const sizeClasses = {
    sm: "w-[var(--control-height-sm)] h-[var(--control-height-sm)]",
    md: "w-[var(--control-height-md)] h-[var(--control-height-md)]",
  } satisfies Record<ControlSize, string>;

  let { el = $bindable(), size = "md", type = "button", class: klass, children, ...rest }: Props = $props();
</script>

<button
  bind:this={el}
  {type}
  class={[
    "border border-[var(--color-control-border)] rounded-[var(--radius)] bg-[var(--color-bg-alt)] text-[var(--color-text)] text-14px leading-none flex items-center justify-center cursor-pointer p-0 transition-[background,border-color] duration-200 hover:bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--color-bg-alt))] hover:border-[var(--color-primary-visual)] aria-[pressed=true]:bg-[color-mix(in_srgb,var(--color-primary)_16%,var(--color-bg-alt))] aria-[pressed=true]:border-[var(--color-primary-visual)] aria-[pressed=true]:text-[var(--color-primary-visual)] aria-[pressed=true]:hover:bg-[color-mix(in_srgb,var(--color-primary)_24%,var(--color-bg-alt))] active:bg-[var(--color-primary)] active:text-[var(--color-text-inverse)] active:border-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-[var(--toolbar-disabled-bg)] [&>svg]:w-4 [&>svg]:h-4",
    sizeClasses[size],
    klass,
  ]}
  {...rest}
>
  {@render children()}
</button>
