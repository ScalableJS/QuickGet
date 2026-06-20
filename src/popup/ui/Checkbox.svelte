<script lang="ts">
  import Check from "~icons/lucide/check";

  import type { Snippet } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";

  type Props = {
    checked?: boolean;
    children: Snippet;
  } & Omit<HTMLInputAttributes, "checked" | "type">;

  let { checked = $bindable(false), id, disabled = false, class: klass, children, ...rest }: Props = $props();
</script>

<label class={["checkbox", disabled && "disabled", klass]}>
  <span class="checkbox-control">
    <input type="checkbox" {id} {disabled} bind:checked {...rest} />
    <span class="checkbox-check" aria-hidden="true"><Check /></span>
  </span>
  {@render children()}
</label>

<style>
  .checkbox {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-weight: 500;
    cursor: pointer;
    color: var(--color-text);
  }

  .checkbox-control {
    position: relative;
    display: grid;
    flex: 0 0 16px;
    width: 16px;
    height: 16px;
  }

  .checkbox input[type="checkbox"] {
    appearance: none;
    width: 16px;
    height: 16px;
    margin: 0;
    display: grid;
    place-content: center;
    border: 1px solid var(--color-control-border);
    border-radius: 3px;
    background: var(--textbox-bg);
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .checkbox-check {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    opacity: 0;
    pointer-events: none;
  }

  .checkbox-check :global(svg) {
    width: 12px;
    height: 12px;
    stroke: var(--color-text-inverse);
    stroke-width: 3;
  }

  .checkbox input[type="checkbox"]:checked + .checkbox-check {
    opacity: 1;
  }

  .checkbox input[type="checkbox"]:checked {
    border-color: var(--color-primary);
    background: var(--color-primary);
  }

  .checkbox input[type="checkbox"]:focus-visible {
    outline: none;
    border-color: var(--color-primary-visual);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }

  .checkbox.disabled {
    color: var(--text-disabled);
    cursor: not-allowed;
  }

  .checkbox input[type="checkbox"]:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
</style>
