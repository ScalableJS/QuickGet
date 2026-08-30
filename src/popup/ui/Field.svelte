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

  const sizeClasses = {
    sm: "h-[var(--control-height-sm)] text-12px",
    md: "h-[var(--control-height-md)] text-13px",
  } satisfies Record<ControlSize, string>;

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

<div class="block">
  {#if label}
    <label for={id} class="block font-600 mb-[var(--spacing-sm)] text-[var(--color-text)]">
      {label}
    </label>
  {/if}
  <input
    {id}
    {type}
    class={[
      "w-full px-[var(--spacing-sm)] border border-solid border-transparent rounded-[var(--radius)] bg-[var(--textbox-bg)] text-[var(--textbox-text)] placeholder:text-[var(--textbox-placeholder)] transition-[background-color,border-color,box-shadow] duration-[var(--duration-fast)] hover:border-[var(--color-control-border)] focus:outline-none focus:border-[var(--color-primary-visual)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-focus-ring)_28%,transparent)]",
      sizeClasses[size],
      error && "border-[var(--color-error)]",
      klass,
    ]}
    aria-invalid={error ? "true" : undefined}
    aria-describedby={describedBy}
    bind:value
    {...rest}
  />

  {#if error}
    <!-- The border colour repeats this; colour alone cannot carry meaning (WCAG 1.4.1). -->
    <p id={errorId} class="mt-[var(--spacing-xs)] mb-0 text-11px text-[var(--color-error)]" role="alert">
      {error}
    </p>
  {:else if hint}
    <p id={hintId} class="mt-[var(--spacing-xs)] mb-0 text-11px text-[var(--text-secondary)]">
      {hint}
    </p>
  {/if}
</div>
