<script lang="ts">
  import type { Snippet } from "svelte";

  // A group of related fields. `<fieldset>`/`<legend>` is what makes it a group for assistive
  // tech — a heading followed by inputs looks the same but announces nothing, so a screen
  // reader cannot tell where "Connection" ends and "Download defaults" begins.
  type Props = { legend: string; children: Snippet };

  let { legend, children }: Props = $props();
</script>

<fieldset class="border-0 m-0 p-0 min-w-0">
  <legend class="p-0 text-13px font-600 text-[var(--color-text)] mb-[var(--space-2)]">{legend}</legend>
  {@render children()}
</fieldset>
