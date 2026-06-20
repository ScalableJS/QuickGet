<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  import type { ControlSize } from "./controlSize.js";

  type Props = {
    variant?: "primary" | "secondary";
    size?: ControlSize;
    block?: boolean;
    children: Snippet;
  } & HTMLButtonAttributes;

  let { variant = "primary", size = "md", block = false, type = "button", class: klass, children, ...rest }: Props = $props();
</script>

<button {type} class={["btn", `btn-${variant}`, `btn-${size}`, block && "btn-block", klass]} {...rest}>
  {@render children()}
</button>

<style>
  .btn {
    min-height: var(--control-height-md);
    padding: 0 var(--space-3);
    border: none;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    flex: 1;
    min-width: 100px;
  }

  .btn-primary {
    background: var(--color-primary);
    color: var(--color-text-inverse);
  }

  .btn-sm {
    min-height: var(--control-height-sm);
    padding: 0 var(--space-2);
    font-size: 12px;
  }

  .btn-primary:hover {
    background: color-mix(in srgb, var(--color-primary) 85%, black);
  }

  .btn-secondary {
    background: var(--color-bg-alt);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-bg);
  }

  .btn-block {
    width: 100%;
    flex: none;
  }

  .btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
</style>
