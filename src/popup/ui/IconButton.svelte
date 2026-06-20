<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  import type { ControlSize } from "./controlSize.js";

  type Props = {
    el?: HTMLButtonElement;
    size?: ControlSize;
    children: Snippet;
  } & HTMLButtonAttributes;

  let { el = $bindable(), size = "md", type = "button", class: klass, children, ...rest }: Props = $props();
</script>

<button bind:this={el} {type} class={["icon-button", `icon-button-${size}`, klass]} {...rest}>
  {@render children()}
</button>

<style>
  .icon-button {
    width: var(--control-height-md);
    height: var(--control-height-md);
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius);
    background: var(--color-bg-alt);
    color: var(--color-text);
    font-size: 14px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;
    padding: 0;
  }

  .icon-button-sm {
    width: var(--control-height-sm);
    height: var(--control-height-sm);
  }

  .icon-button :global(svg) {
    width: 16px;
    height: 16px;
  }

  .icon-button:hover {
    background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-alt));
    border-color: var(--color-primary-visual);
  }

  .icon-button:active {
    background: var(--color-primary);
    color: var(--color-text-inverse);
    border-color: var(--color-primary);
  }

  .icon-button:disabled,
  .icon-button[disabled] {
    opacity: 0.4;
    cursor: not-allowed;
    background: var(--toolbar-disabled-bg);
  }
</style>
