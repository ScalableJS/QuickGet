<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Props = {
    expanded: boolean;
    children: Snippet;
  } & HTMLButtonAttributes;

  let { expanded, type = "button", class: klass, children, ...rest }: Props = $props();
</script>

<button {type} class={["disclosure", klass]} aria-expanded={expanded} {...rest}>
  {@render children()}
</button>

<style>
  .disclosure {
    margin-top: 6px;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 2px 8px;
    font-size: 12px;
    cursor: pointer;
    color: var(--color-primary);
  }

  .disclosure:hover {
    background: var(--color-bg-alt);
  }
</style>
