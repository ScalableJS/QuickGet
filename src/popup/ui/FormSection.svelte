<script lang="ts">
  import type { Snippet } from "svelte";

  // A group of related fields. `<fieldset>`/`<legend>` is what makes it a group for assistive
  // tech — a heading followed by inputs looks the same but announces nothing, so a screen
  // reader cannot tell where "Connection" ends and "Download defaults" begins.
  type Props = { legend: string; children: Snippet };

  let { legend, children }: Props = $props();
</script>

<fieldset class="form-section">
  <legend class="form-legend">{legend}</legend>
  {@render children()}
</fieldset>

<style>
  /* Browsers give fieldset a border, padding and margin of its own; the section styling comes
     from the surrounding layout, so they are reset rather than worked around. */
  .form-section {
    border: none;
    margin: 0;
    padding: 0;
    min-width: 0;
  }

  .form-legend {
    padding: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: var(--space-2);
  }
</style>
