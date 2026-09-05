<script lang="ts">
  type Variant = "active" | "complete" | "error" | "seeding";
  type Props = {
    value: number;
    label: string;
    variant?: Variant;
    inline?: boolean;
  };

  const variantClasses = {
    active: "bg-[var(--color-primary-visual)]",
    complete: "bg-[var(--progress-fill-complete)]",
    error: "bg-[var(--progress-fill-error)]",
    seeding: "bg-[var(--progress-fill-seeding)]",
  } satisfies Record<Variant, string>;

  const trackClasses = {
    active: "bg-[var(--progress-track-active)]",
    complete: "bg-[var(--progress-track-active)]",
    error: "bg-[var(--progress-track-active)]",
    seeding: "bg-[var(--progress-track-seeding)]",
  } satisfies Record<Variant, string>;

  let { value, label, variant = "active", inline = false }: Props = $props();

  const clamped = $derived(Math.max(0, Math.min(100, value)));
</script>

<div
  class={[
    "h-[5px] rounded-full overflow-hidden",
    trackClasses[variant],
    inline ? "w-auto min-w-0 flex-1" : "w-full flex-none",
  ]}
  role="progressbar"
  aria-label={label}
  aria-valuenow={clamped}
  aria-valuemin={0}
  aria-valuemax={100}
>
  <div class={["h-full rounded-full transition-[width,background] duration-300", variantClasses[variant]]} style="width: {clamped}%"></div>
</div>
