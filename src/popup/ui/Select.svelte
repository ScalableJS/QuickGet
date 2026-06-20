<script lang="ts">
  import ChevronDown from "~icons/lucide/chevron-down";

  import type { Snippet } from "svelte";
  import type { HTMLSelectAttributes } from "svelte/elements";

  import type { ControlSize } from "./controlSize.js";

  type Props = {
    id?: string;
    label?: string;
    value?: string;
    size?: ControlSize;
    children: Snippet;
  } & Omit<HTMLSelectAttributes, "size" | "value">;

  let { id, label, value = $bindable(""), size = "md", class: klass, children, ...rest }: Props = $props();
</script>

<div class="field">
  {#if label}
    <label for={id}>{label}</label>
  {/if}
  <div class="select-control">
    <select {id} class={["field-select", `field-select-${size}`, klass]} bind:value {...rest}>
      {@render children()}
    </select>
    <span class="select-icon" aria-hidden="true"><ChevronDown /></span>
  </div>
</div>

<style>
  .field {
    position: relative;
    display: block;
  }

  label {
    display: block;
    font-weight: 500;
    margin-bottom: var(--spacing-sm);
    color: var(--color-text);
  }

  .field-select {
    width: 100%;
    height: var(--control-height-md);
    appearance: none;
    padding: 0 var(--space-6) 0 var(--spacing-sm);
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius);
    font-size: 13px;
    font-family: inherit;
    background: var(--textbox-bg);
    color: var(--textbox-text);
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .select-control {
    position: relative;
  }

  .field-select-sm {
    height: var(--control-height-sm);
    font-size: 12px;
  }

  .field-select:focus {
    outline: none;
    border-color: var(--color-primary-visual);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }

  .select-icon {
    position: absolute;
    right: var(--space-3);
    top: 50%;
    width: 16px;
    height: 16px;
    color: var(--color-text-secondary);
    pointer-events: none;
    transform: translateY(-50%);
  }

  .select-icon :global(svg) {
    width: 16px;
    height: 16px;
  }
</style>
