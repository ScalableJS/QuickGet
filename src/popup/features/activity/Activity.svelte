<script lang="ts">
  import { onMount } from "svelte";

  import { type ActivityEntry, clearActivity, readActivity } from "@lib/activityLog.js";
  import { Link } from "@ui";

  // Successful sends no longer raise a notification, so this is the only place they surface.
  // Collapsed by default: it answers a question the user only sometimes has.
  let entries = $state<ActivityEntry[]>([]);
  let expanded = $state(false);

  onMount(async () => {
    entries = await readActivity();
  });

  const OUTCOME_LABEL: Record<ActivityEntry["outcome"], string> = {
    sent: "Sent to NAS",
    duplicate: "Already on NAS",
    failed: "Failed",
    "left-to-browser": "Saved by browser",
  };

  function formatTime(at: number): string {
    return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  async function handleClear(): Promise<void> {
    await clearActivity();
    entries = [];
  }
</script>

{#if entries.length > 0}
  <section class="activity">
    <button
      type="button"
      class="activity-toggle"
      aria-expanded={expanded}
      onclick={() => (expanded = !expanded)}
    >
      Recent activity ({entries.length})
    </button>

    {#if expanded}
      <ul class="activity-list">
        {#each entries as entry (entry.at)}
          <li class="activity-entry">
            <span class="activity-time">{formatTime(entry.at)}</span>
            <span class="activity-name" title={entry.name}>{entry.name}</span>
            <span class="activity-outcome" class:problem={entry.outcome === "left-to-browser" || entry.outcome === "failed"}>
              {OUTCOME_LABEL[entry.outcome]}
            </span>
            {#if entry.detail}
              <span class="activity-detail">{entry.detail}</span>
            {/if}
          </li>
        {/each}
      </ul>

      <div class="activity-actions">
        <Link size="small" onclick={handleClear}>Clear activity</Link>
      </div>
    {/if}
  </section>
{/if}

<style>
  .activity {
    border-top: 1px solid var(--color-control-border);
    padding-top: var(--space-2);
    margin-top: var(--space-2);
  }

  .activity-toggle {
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: var(--space-1) 0;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .activity-toggle:hover {
    color: var(--color-text);
  }

  .activity-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .activity-entry {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-1) var(--space-2);
    align-items: baseline;
    padding: var(--space-1) 0;
    font-size: 12px;
  }

  .activity-time {
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .activity-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .activity-outcome {
    color: var(--text-secondary);
  }

  .activity-outcome.problem {
    color: var(--color-warning);
  }

  .activity-detail {
    grid-column: 1 / -1;
    color: var(--text-secondary);
    font-size: 11px;
  }

  .activity-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--space-1);
  }
</style>
