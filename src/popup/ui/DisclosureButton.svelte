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
    "mt-[6px] bg-transparent border border-[var(--color-border)] rounded-[var(--radius)] px-2 py-[2px] text-12px cursor-pointer text-[var(--color-primary)] hover:bg-[var(--color-bg-alt)]",
    klass,
  ]}
  aria-expanded={expanded}
  {...rest}
>
  {@render children()}
</button>
