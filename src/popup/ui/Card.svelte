<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type Props = {
    variant?: "filled" | "plain";
    children: Snippet;
  } & HTMLAttributes<HTMLElement>;

  let { variant = "filled", class: klass, children, ...rest }: Props = $props();
</script>

<section class={["card", variant === "plain" && "card-plain", klass]} {...rest}>
  {@render children()}
</section>

<style>
  .card {
    background: var(--color-bg-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-md);
  }

  .card-plain {
    background: transparent;
    border: none;
    padding: 0;
    margin-bottom: 0;
  }
</style>
