<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  import type { ControlSize } from "./controlSize.js";

  type Props = {
    value?: string;
    size?: ControlSize;
  } & Omit<HTMLInputAttributes, "size" | "value" | "type">;

  let { value = $bindable(""), size = "md", class: klass, ...rest }: Props = $props();
</script>

<div class="search-field">
  <input type="search" class={["search-input", `search-input-${size}`, klass]} bind:value {...rest} />
  {#if value}
    <button type="button" class="search-clear" aria-label="Clear search" onclick={() => (value = "")}>×</button>
  {/if}
</div>

<style>
  .search-field {
    position: relative;
    width: 100%;
  }

  .search-input {
    width: 100%;
    height: var(--control-height-md);
    box-sizing: border-box;
    padding: 0 calc(var(--spacing-sm) + 18px) 0 var(--spacing-sm);
    border: 1px solid var(--color-control-border);
    border-radius: var(--radius);
    background: var(--torrent-bg);
    color: var(--color-text);
    font-size: 13px;
  }

  .search-input-sm {
    height: var(--control-height-sm);
    font-size: 12px;
  }

  /* Hide the native search clear — we render our own. */
  .search-input::-webkit-search-cancel-button {
    appearance: none;
  }

  .search-clear {
    position: absolute;
    top: 50%;
    right: 6px;
    transform: translateY(-50%);
    border: none;
    background: none;
    color: var(--color-text-secondary);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
  }

  .search-clear:hover {
    color: var(--color-text);
  }
</style>
