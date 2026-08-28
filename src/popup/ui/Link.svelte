<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Size = "default" | "small";
  type Props = {
    size?: Size;
    children: Snippet;
  } & HTMLButtonAttributes;

  const sizeClasses = {
    default: "text-[0.85rem]",
    small: "text-[0.8rem]",
  } satisfies Record<Size, string>;

  let { size = "default", type = "button", class: klass, children, ...rest }: Props = $props();
</script>

<button
  {type}
  class={[
    "bg-transparent border-0 text-[var(--color-primary)] cursor-pointer underline p-0 hover:text-[color-mix(in_srgb,var(--color-primary)_75%,black)] disabled:opacity-55 disabled:cursor-not-allowed",
    sizeClasses[size],
    klass,
  ]}
  {...rest}
>
  {@render children()}
</button>
