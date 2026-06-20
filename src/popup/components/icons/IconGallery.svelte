<script lang="ts">
  import ArrowDown from "~icons/lucide/arrow-down";
  import ArrowUp from "~icons/lucide/arrow-up";
  import Circle from "~icons/lucide/circle";
  import CircleCheck from "~icons/lucide/circle-check";
  import CircleStop from "~icons/lucide/circle-stop";
  import Clock from "~icons/lucide/clock";
  import LoaderCircle from "~icons/lucide/loader-circle";
  import PackageOpen from "~icons/lucide/package-open";
  import Pause from "~icons/lucide/pause";
  import Play from "~icons/lucide/play";
  import Plus from "~icons/lucide/plus";
  import ScanLine from "~icons/lucide/scan-line";
  import Settings from "~icons/lucide/settings";
  import Trash2 from "~icons/lucide/trash-2";
  import TriangleAlert from "~icons/lucide/triangle-alert";
  import Wrench from "~icons/lucide/wrench";

  // Project icon set — lucide, bundled at build time (CSP-safe, no runtime API).
  const statuses = [
    { label: "downloading", name: "arrow-down", tone: "blue", Icon: ArrowDown, why: "download direction" },
    { label: "seeding", name: "arrow-up", tone: "green", Icon: ArrowUp, why: "upload or seed direction" },
    { label: "queued", name: "clock", tone: "muted", Icon: Clock, why: "waiting in queue" },
    { label: "paused", name: "pause", tone: "muted", Icon: Pause, why: "user-paused" },
    { label: "stopped", name: "circle-stop", tone: "muted", Icon: CircleStop, why: "stopped" },
    { label: "checking", name: "scan-line", tone: "blue", Icon: ScanLine, why: "verifying data" },
    { label: "repairing", name: "wrench", tone: "orange", Icon: Wrench, why: "repairing" },
    { label: "extracting", name: "package-open", tone: "muted", Icon: PackageOpen, why: "unpacking archive" },
    { label: "finishing", name: "loader-circle", tone: "blue", Icon: LoaderCircle, why: "finalizing/moving" },
    { label: "finished", name: "circle-check", tone: "green", Icon: CircleCheck, why: "complete" },
    { label: "error", name: "triangle-alert", tone: "red", Icon: TriangleAlert, why: "error (red)" },
    { label: "default", name: "circle", tone: "muted", Icon: Circle, why: "unknown state" },
  ];

  const toolbar = [
    { label: "settings", name: "settings", Icon: Settings },
    { label: "start", name: "play", Icon: Play },
    { label: "stop", name: "circle-stop", Icon: CircleStop },
    { label: "pause", name: "pause", Icon: Pause },
    { label: "add", name: "plus", Icon: Plus },
    { label: "remove", name: "trash-2", Icon: Trash2 },
  ];

  const toneColor: Record<string, string> = {
    blue: "var(--color-primary)",
    green: "var(--color-success)",
    red: "var(--color-error)",
    orange: "var(--color-warning)",
    muted: "var(--color-text-secondary)",
  };
</script>

<div class="gallery">
  <section>
    <h3>Download statuses</h3>
    <p class="note">Icon + colour both encode state, mirroring desktop torrent clients.</p>
    <div class="grid">
      {#each statuses as s (s.label)}
        <div class="cell">
          <span class="ico" style="color: {toneColor[s.tone]}"><s.Icon /></span>
          <div class="meta">
            <strong>{s.label}</strong>
            <code>lucide/{s.name}</code>
            <small>{s.why}</small>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section>
    <h3>Toolbar controls</h3>
    <p class="note">Task-control row (start/stop/pause), add, and delete (trash = client convention).</p>
    <div class="grid">
      {#each toolbar as t (t.label)}
        <div class="cell">
          <span class="ico"><t.Icon /></span>
          <div class="meta">
            <strong>{t.label}</strong>
            <code>lucide/{t.name}</code>
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .gallery {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 640px;
  }
  h3 {
    margin: 0 0 4px;
  }
  .note {
    margin: 0 0 12px;
    opacity: 0.7;
    font-size: 13px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }
  .cell {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border: 1px solid var(--color-border, #ddd);
    border-radius: 8px;
  }
  .ico :global(svg) {
    width: 22px;
    height: 22px;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  code {
    font-size: 11px;
    opacity: 0.8;
  }
  small {
    font-size: 11px;
    opacity: 0.6;
  }
</style>
