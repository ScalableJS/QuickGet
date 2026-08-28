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
      "bg-[var(--color-primary)] text-[var(--color-text-inverse)] hover:bg-[color-mix(in_srgb,var(--color-primary)_85%,black)]",
    secondary:
      "border border-[var(--color-border)] bg-[var(--color-bg-alt)] text-[var(--color-text)] hover:bg-[var(--color-bg)]",
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
    "btn min-w-[100px] flex-1 cursor-pointer rounded-[var(--radius)] border-0 font-500 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-55",
    variantClasses[variant],
    sizeClasses[size],
    block && "w-full flex-none",
    klass,
  ]}
  {...rest}
>
  {@render children()}
</button>
