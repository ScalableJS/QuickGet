<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  import type { ControlSize } from "./controlSize.js";

  type Props = {
    id?: string;
    label?: string;
    value?: string;
    size?: ControlSize;
  } & Omit<HTMLInputAttributes, "size" | "value">;

  let { id, label, value = $bindable(""), type = "text", size = "md", class: klass, ...rest }: Props = $props();
</script>

<div class="field">
  {#if label}
    <label for={id}>{label}</label>
  {/if}
  <input {id} {type} class={["field-input", `field-input-${size}`, klass]} bind:value {...rest} />
</div>

<style>
  .field {
    display: block;
  }

  label {
    display: block;
    font-weight: 500;
    margin-bottom: var(--spacing-sm);
    color: var(--color-text);
  }

  .field-input {
    width: 100%;
    height: var(--control-height-md);
    padding: 0 var(--spacing-sm);
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius);
    font-size: 13px;
    font-family: inherit;
    background: var(--textbox-bg);
    color: var(--textbox-text);
    transition: border-color 0.2s;
  }

  .field-input-sm {
    height: var(--control-height-sm);
    font-size: 12px;
  }

  .field-input::placeholder {
    color: var(--textbox-placeholder);
  }

  .field-input:focus {
    outline: none;
    border-color: var(--color-primary-visual);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }
</style>
