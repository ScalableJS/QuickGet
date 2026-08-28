<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "count" | "accent";
  type Props = {
    variant?: Variant;
    title?: string;
    children: Snippet;
  };

  const variantClasses = {
    count: "min-w-4 px-1 rounded-full bg-[color-mix(in_srgb,currentColor_22%,transparent)] leading-4",
    accent: "ml-1 px-1.5 rounded-[10px] bg-[var(--color-primary)] text-[var(--color-text-inverse)]",
  } satisfies Record<Variant, string>;

  let { variant = "count", title, children }: Props = $props();
</script>

<span
  class={[
    "inline-block text-12px font-600 tabular-nums text-center",
    variantClasses[variant],
  ]}
  {title}
>
  {@render children()}
</span>
