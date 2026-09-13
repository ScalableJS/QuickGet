<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  import type { ControlSize } from "./controlSize.js";

  type Variant = "primary" | "secondary" | "destructive";
  type Props = {
    variant?: Variant;
    size?: ControlSize;
    block?: boolean;
    children: Snippet;
  } & HTMLButtonAttributes;

  const layoutClasses =
    "inline-flex min-w-[100px] flex-1 items-center justify-center rounded-[var(--radius)] font-600 cursor-pointer";
  const transitionClasses =
    "transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-fast)] ease-out";
  const focusClasses =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]";
  const activeClasses = "active:translate-y-px";
  const disabledClasses = "disabled:cursor-not-allowed disabled:opacity-45";

  const variantClasses = {
    primary: [
      "border border-solid border-transparent",
      "bg-[var(--color-primary-solid)] text-[var(--color-text-on-primary)]",
      "hover:bg-[var(--color-primary-solid-hover)]",
      "active:bg-[var(--color-primary-solid-active)]",
    ].join(" "),
    secondary: [
      "border border-solid border-transparent",
      "bg-[var(--color-bg-alt)] text-[var(--color-text)]",
      "hover:border-[var(--color-control-border)] hover:bg-[var(--color-bg-raised)]",
      "active:bg-[var(--color-primary-subtle)]",
    ].join(" "),
    // Outlined rather than filled: `--color-error` is tuned as a *text* colour against the page
    // background (WCAG 1.4.3), and no contrast-checked on-error foreground exists to fill it with.
    // The border carries the warning, and the label keeps a measured 4.5:1.
    destructive: [
      "border border-solid border-[var(--color-error)]",
      "bg-transparent text-[var(--color-error)]",
      "hover:bg-[color-mix(in_srgb,var(--color-error)_12%,var(--color-bg))]",
      "active:bg-[color-mix(in_srgb,var(--color-error)_20%,var(--color-bg))]",
    ].join(" "),
  } satisfies Record<Variant, string>;

  const sizeClasses = {
    sm: "min-h-[var(--control-height-sm)] px-2 text-12px",
    md: "min-h-[var(--control-height-md)] px-3 text-13px",
  } satisfies Record<ControlSize, string>;

  let {
    variant = "primary",
    size = "md",
    block = false,
    type = "button",
    class: klass,
    children,
    ...rest
  }: Props = $props();
</script>

<button
  {type}
  class={[
    layoutClasses,
    transitionClasses,
    focusClasses,
    activeClasses,
    disabledClasses,
    variantClasses[variant],
    sizeClasses[size],
    block && "w-full flex-none",
    klass,
  ]}
  {...rest}
>
  {@render children()}
</button>
