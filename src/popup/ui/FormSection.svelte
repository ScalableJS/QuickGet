<script lang="ts">
  import type { Snippet } from "svelte";

  // A group of related fields. `<fieldset>`/`<legend>` is what makes it a group for assistive
  // tech — a heading followed by inputs looks the same but announces nothing, so a screen
  // reader cannot tell where "Connection" ends and "Download defaults" begins.
  //
  // It also owns the section boundary, rather than leaving each caller to invent one: the
  // spacing that separates two sections cannot be forgotten if the section itself carries it,
  // and forgetting it is exactly what made "Folders" read as part of "Connection". The rhythm
  // is 16px between fields and 16px + hairline + 16px between sections — in a 450px popup with
  // 12–13px type, a rule earns the boundary more cheaply than 24px of empty space would.
  //
  // The divider is a *bottom* border on every section but the last, not a top border on every
  // section but the first: a `<legend>` splits its fieldset's top border and leaves a notch.
  type Props = { legend: string; children: Snippet };

  let { legend, children }: Props = $props();
</script>

<fieldset
  class="border-0 m-0 p-0 min-w-0 [&:not(:last-child)]:mb-4 [&:not(:last-child)]:pb-4 [&:not(:last-child)]:border-b-1 [&:not(:last-child)]:border-b-solid [&:not(:last-child)]:border-b-[var(--color-border)]"
>
  <legend class="p-0 text-13px font-600 text-[var(--color-text)] mb-2">{legend}</legend>
  <div class="flex flex-col gap-4">
    {@render children()}
  </div>
</fieldset>
