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

  const toneClasses: Record<string, string> = {
    blue: "text-[var(--color-primary)]",
    green: "text-[var(--color-success)]",
    red: "text-[var(--color-error)]",
    orange: "text-[var(--color-warning)]",
    muted: "text-[var(--color-text-secondary)]",
  };
</script>

<div class="flex flex-col gap-6 max-w-[640px]">
  <section>
    <h3 class="m-0 mb-1 font-600 text-16px">Download statuses</h3>
    <p class="m-0 mb-3 opacity-70 text-13px">Icon + colour both encode state, mirroring desktop torrent clients.</p>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {#each statuses as s (s.label)}
        <div class="flex items-center gap-[10px] p-[10px] border border-[var(--color-border)] rounded-lg">
          <span class={["[&>svg]:w-[22px] [&>svg]:h-[22px]", toneClasses[s.tone]]}><s.Icon /></span>
          <div class="flex flex-col gap-[2px] min-w-0">
            <strong>{s.label}</strong>
            <code class="text-11px opacity-80 font-mono">lucide/{s.name}</code>
            <small class="text-11px opacity-60">{s.why}</small>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section>
    <h3 class="m-0 mb-1 font-600 text-16px">Toolbar controls</h3>
    <p class="m-0 mb-3 opacity-70 text-13px">Task-control row (start/stop/pause), add, and delete (trash = client convention).</p>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {#each toolbar as t (t.label)}
        <div class="flex items-center gap-[10px] p-[10px] border border-[var(--color-border)] rounded-lg">
          <span class="[&>svg]:w-[22px] [&>svg]:h-[22px]"><t.Icon /></span>
          <div class="flex flex-col gap-[2px] min-w-0">
            <strong>{t.label}</strong>
            <code class="text-11px opacity-80 font-mono">lucide/{t.name}</code>
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>
