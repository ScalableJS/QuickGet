<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  import type { ControlSize } from "./controlSize.js";

  type Props = {
    el?: HTMLButtonElement;
    size?: ControlSize;
    children: Snippet;
  } & HTMLButtonAttributes;

  const layoutClasses = "inline-flex items-center justify-center border border-solid border-transparent rounded-[var(--radius)] leading-none cursor-pointer p-0";
  const appearanceClasses = "bg-[var(--color-bg-alt)] text-[var(--color-text)]";
  const transitionClasses =
    "transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-fast)] ease-out";
  const hoverClasses = "hover:bg-[var(--color-bg-raised)] hover:border-[var(--color-control-border)]";
  const activeClasses = "active:bg-[var(--color-primary-subtle)] active:text-[var(--color-primary)] active:translate-y-px";
  const pressedClasses =
    "aria-[pressed=true]:bg-[var(--color-primary-subtle)] aria-[pressed=true]:border-[var(--color-primary-visual)] aria-[pressed=true]:text-[var(--color-primary)]";
  const focusClasses =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]";
  const disabledClasses = "disabled:cursor-not-allowed disabled:opacity-45";
  const iconClasses = "[&>svg]:w-4 [&>svg]:h-4";

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
    layoutClasses,
    appearanceClasses,
    transitionClasses,
    hoverClasses,
    activeClasses,
    pressedClasses,
    focusClasses,
    disabledClasses,
    iconClasses,
    sizeClasses[size],
    klass,
  ]}
  {...rest}
>
  {@render children()}
</button>
