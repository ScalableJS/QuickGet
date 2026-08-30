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

<label
  class={[
    "flex items-center gap-[var(--spacing-sm)] font-500 cursor-pointer text-[var(--color-text)]",
    disabled && "cursor-not-allowed text-[var(--text-disabled)]",
    klass,
  ]}
>
  <span class="relative grid flex-none w-4 h-4 place-content-center">
    <input
      type="checkbox"
      {id}
      {disabled}
      bind:checked
      class="peer appearance-none m-0 w-4 h-4 grid place-content-center rounded-[4px] border border-solid border-[var(--color-checkbox-border)] bg-[var(--color-bg-raised)] cursor-pointer transition-[background-color,border-color,box-shadow,transform] duration-[var(--duration-fast)] hover:border-[var(--color-primary-visual)] active:scale-95 checked:border-[var(--color-primary-solid)] checked:bg-[var(--color-primary-solid)] focus-visible:outline-none focus-visible:border-[var(--color-primary-visual)] focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-focus-ring)_28%,transparent)] disabled:cursor-not-allowed disabled:opacity-45"
      {...rest}
    />
    <span
      class="pointer-events-none absolute inset-0 grid place-content-center opacity-0 peer-checked:opacity-100 [&>svg]:w-3 [&>svg]:h-3 [&>svg]:stroke-[var(--color-text-on-primary)] [&>svg]:[stroke-width:3]"
      aria-hidden="true"
    >
      <Check />
    </span>
  </span>
  {@render children()}
</label>
