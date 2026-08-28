<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  import type { ControlSize } from "./controlSize.js";

  type Props = {
    id?: string;
    label?: string;
    value?: string;
    size?: ControlSize;
    /** Shown under the field and announced; also marks the input invalid. */
    error?: string;
    /** Persistent guidance, shown only while there is no error to show instead. */
    hint?: string;
  } & Omit<HTMLInputAttributes, "size" | "value">;

  let {
    id,
    label,
    value = $bindable(""),
    type = "text",
    size = "md",
    error,
    hint,
    class: klass,
    ...rest
  }: Props = $props();

  // Assistive tech needs the message tied to the input, not merely placed near it.
  const errorId = $derived(id && error ? `${id}-error` : undefined);
  const hintId = $derived(id && hint && !error ? `${id}-hint` : undefined);
  const describedBy = $derived([errorId, hintId].filter(Boolean).join(" ") || undefined);
</script>

<div class="field">
  {#if label}
    <label for={id}>{label}</label>
  {/if}
  <input
    {id}
    {type}
    class={["field-input", `field-input-${size}`, klass]}
    class:invalid={error}
    aria-invalid={error ? "true" : undefined}
    aria-describedby={describedBy}
    bind:value
    {...rest}
  />

  {#if error}
    <!-- The border colour repeats this; colour alone cannot carry meaning (WCAG 1.4.1). -->
    <p id={errorId} class="field-error" role="alert">{error}</p>
  {:else if hint}
    <p id={hintId} class="field-hint">{hint}</p>
  {/if}
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

  .field-input.invalid {
    border-color: var(--color-error);
  }

  .field-error,
  .field-hint {
    margin: var(--spacing-xs) 0 0;
    font-size: 11px;
  }

  .field-error {
    color: var(--color-error);
  }

  .field-hint {
    color: var(--text-secondary);
  }

  .field-input:focus {
    outline: none;
    border-color: var(--color-primary-visual);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }
</style>
