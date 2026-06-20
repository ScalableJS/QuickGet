<script lang="ts">
  type Props = {
    value: number;
    variant?: "active" | "complete" | "error";
    selected?: boolean;
  };

  let { value, variant = "active", selected = false }: Props = $props();

  const clamped = $derived(Math.max(0, Math.min(100, value)));
</script>

<div class="progress-bar" class:selected role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
  <div class="progress-fill progress-{variant}" class:selected style="width: {clamped}%"></div>
</div>

<style>
  .progress-bar {
    flex: 1;
    height: 4px;
    background: var(--progress-track-active);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar.selected {
    background: var(--progress-track-selected);
  }

  .progress-fill {
    height: 100%;
    border-radius: 2px;
    transition:
      width 0.3s ease,
      background 0.3s ease;
  }

  .progress-active {
    background: var(--color-primary-visual);
  }

  .progress-complete {
    background: var(--progress-fill-complete);
  }

  .progress-error {
    background: var(--progress-fill-error);
  }

  .progress-fill.selected {
    background: var(--progress-fill-selected);
  }
</style>
