<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type Variant = "filled" | "plain";
  type Props = {
    variant?: Variant;
    children: Snippet;
  } & HTMLAttributes<HTMLElement>;

  const variantClasses = {
    filled:
      "bg-[var(--color-bg-raised)] rounded-[var(--radius-container)] shadow-[var(--shadow-card)] p-[var(--spacing-md)] mb-[var(--spacing-md)]",
    plain: "bg-transparent border-0 p-0 mb-0",
  } satisfies Record<Variant, string>;

  let { variant = "filled", class: klass, children, ...rest }: Props = $props();
</script>

<section class={["card", variantClasses[variant], klass]} {...rest}>
  {@render children()}
</section>
