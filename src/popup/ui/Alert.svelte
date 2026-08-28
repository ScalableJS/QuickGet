<script lang="ts">
  import type { Snippet } from "svelte";

  type Tone = "hint" | "error" | "warning";
  type Props = {
    tone?: Tone;
    children: Snippet;
  };

  const toneClasses = {
    hint: "text-[var(--color-text-secondary)]",
    error: "text-[var(--color-error)]",
    warning: "text-[var(--color-warning)]",
  } satisfies Record<Tone, string>;

  let { tone = "hint", children }: Props = $props();
</script>

<p class={["m-0 text-12px", toneClasses[tone]]} aria-live={tone === "hint" ? "off" : "polite"}>
  {@render children()}
</p>
