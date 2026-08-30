<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  import type { ControlSize } from "./controlSize.js";

  type Variant = "primary" | "secondary";
  type Props = {
    variant?: Variant;
    size?: ControlSize;
    block?: boolean;
    children: Snippet;
  } & HTMLButtonAttributes;

  const variantClasses = {
    primary:
      "border border-solid border-transparent bg-[var(--color-primary-solid)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary-solid-hover)] active:bg-[var(--color-primary-solid-active)]",
    secondary:
      "border border-solid border-transparent bg-[var(--color-bg-alt)] text-[var(--color-text)] hover:border-[var(--color-control-border)] hover:bg-[var(--color-bg-raised)] active:bg-[var(--color-primary-subtle)]",
  } satisfies Record<Variant, string>;

  const sizeClasses = {
    sm: "min-h-[var(--control-height-sm)] px-[var(--space-2)] text-12px",
    md: "min-h-[var(--control-height-md)] px-[var(--space-3)] text-13px",
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
    "inline-flex min-w-[100px] flex-1 items-center justify-center rounded-[var(--radius)] font-600 cursor-pointer transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-fast)] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
    variantClasses[variant],
    sizeClasses[size],
    block && "w-full flex-none",
    klass,
  ]}
  {...rest}
>
  {@render children()}
</button>
