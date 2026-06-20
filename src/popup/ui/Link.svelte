<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Props = {
    size?: "default" | "small";
    children: Snippet;
  } & HTMLButtonAttributes;

  let { size = "default", type = "button", class: klass, children, ...rest }: Props = $props();
</script>

<button {type} class={["link", size === "small" && "link-small", klass]} {...rest}>
  {@render children()}
</button>

<style>
  .link {
    background: none;
    border: none;
    color: var(--color-primary);
    font-size: 0.85rem;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }

  .link-small {
    font-size: 0.8rem;
  }

  .link:hover {
    color: color-mix(in srgb, var(--color-primary) 75%, black);
  }

  .link:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
</style>
