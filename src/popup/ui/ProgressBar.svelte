<script lang="ts">
  type Props = {
    value: number;
    variant?: "active" | "complete" | "error";
    inline?: boolean;
  };

  let { value, variant = "active", inline = false }: Props = $props();

  const clamped = $derived(Math.max(0, Math.min(100, value)));
</script>

<div class="progress-bar" class:inline role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
  <div class="progress-fill progress-{variant}" style="width: {clamped}%"></div>
</div>

<style>
  .progress-bar {
    width: 100%;
    flex: none;
    height: 4px;
    background: var(--progress-track-active);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar.inline {
    width: auto;
    min-width: 0;
    flex: 1;
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
</style>
