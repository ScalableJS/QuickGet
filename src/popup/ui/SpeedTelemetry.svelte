<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import ArrowDown from "~icons/lucide/arrow-down";
  import ArrowUp from "~icons/lucide/arrow-up";
  import { formatRate } from "../shared/formatters/speed.js";

  type Direction = "down" | "up";

  type Props = HTMLAttributes<HTMLSpanElement> & {
    /** Single direction arrow: "down" | "up" */
    direction?: Direction;
    /** Formatted speed text (e.g. "12.0MB/s") */
    value?: string;
    /** Raw bytes per second number (formatted via formatRate) */
    bytes?: number;
    /** Download speed for dual header mode */
    down?: string | number;
    /** Upload speed for dual header mode */
    up?: string | number;
    /** Optional custom class for the speed number span */
    textClass?: string;
  };

  let {
    direction,
    value,
    bytes,
    down,
    up,
    class: className = "",
    textClass = "",
    ...restProps
  }: Props = $props();

  function resolveSpeed(val?: string | number): string {
    if (typeof val === "number") return formatRate(val);
    if (typeof val === "string") return val;
    return "";
  }

  let isDual = $derived(down !== undefined || up !== undefined);

  let singleSpeed = $derived(
    value !== undefined
      ? value
      : bytes !== undefined
        ? formatRate(bytes)
        : "0B/s"
  );

  let downSpeed = $derived(resolveSpeed(down));
  let upSpeed = $derived(resolveSpeed(up));
</script>

{#if isDual}
  <span
    class={[
      "inline-flex items-center gap-2 select-none tabular-nums whitespace-nowrap text-11px font-500 [&>svg]:w-3 [&>svg]:h-3 flex-none",
      className,
    ]}
    {...restProps}
  >
    {#if downSpeed}
      <span class="inline-flex items-center whitespace-nowrap text-[var(--color-primary-visual)]">
        <ArrowDown aria-hidden="true" class="flex-none" /><span class={["text-[var(--color-text)] tabular-nums", textClass]}>{downSpeed}</span>
      </span>
    {/if}
    {#if upSpeed}
      <span class="inline-flex items-center whitespace-nowrap text-[var(--progress-fill-seeding)]">
        <ArrowUp aria-hidden="true" class="flex-none" /><span class={["text-[var(--color-text-secondary)] tabular-nums", textClass]}>{upSpeed}</span>
      </span>
    {/if}
  </span>
{:else}
  {@const isDown = direction !== "up"}
  <span
    class={[
      "inline-flex items-center whitespace-nowrap tabular-nums [&>svg]:w-3 [&>svg]:h-3 flex-none",
      isDown ? "text-[var(--color-primary-visual)]" : "text-[var(--progress-fill-seeding)]",
      className,
    ]}
    {...restProps}
  >
    {#if isDown}
      <ArrowDown aria-hidden="true" class="flex-none" />
    {:else}
      <ArrowUp aria-hidden="true" class="flex-none" />
    {/if}
    <span class={["tabular-nums", textClass]}>{singleSpeed}</span>
  </span>
{/if}
