<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Props = {
    expanded: boolean;
    children: Snippet;
  } & HTMLButtonAttributes;

  let { expanded, type = "button", class: klass, children, ...rest }: Props = $props();
</script>

<button
  {type}
  class={[
    "mt-[6px] inline-flex items-center rounded-[var(--radius)] bg-[var(--color-bg-alt)] border border-solid border-transparent px-2 py-[2px] text-12px font-600 cursor-pointer text-[var(--color-primary)] transition-[background-color,border-color,box-shadow,transform] duration-[var(--duration-fast)] hover:bg-[var(--color-bg-raised)] hover:border-[var(--color-control-border)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
    klass,
  ]}
  aria-expanded={expanded}
  {...rest}
>
  {@render children()}
</button>
