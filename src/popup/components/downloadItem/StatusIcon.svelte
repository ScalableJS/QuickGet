<script lang="ts">
  import type { TaskStatus } from "@lib/tasks.js";

  import ArrowDown from "~icons/lucide/arrow-down";
  import ArrowUp from "~icons/lucide/arrow-up";
  import Circle from "~icons/lucide/circle";
  import CircleCheck from "~icons/lucide/circle-check";
  import CircleStop from "~icons/lucide/circle-stop";
  import Clock from "~icons/lucide/clock";
  import LoaderCircle from "~icons/lucide/loader-circle";
  import PackageOpen from "~icons/lucide/package-open";
  import Pause from "~icons/lucide/pause";
  import ScanLine from "~icons/lucide/scan-line";
  import TriangleAlert from "~icons/lucide/triangle-alert";
  import Wrench from "~icons/lucide/wrench";

  let { status }: { status: TaskStatus } = $props();

  // Icon convention follows torrent clients (qBittorrent/Transmission):
  // Arrow-down denotes download, arrow-up denotes seed, and alert denotes error.
  const ICONS = {
    downloading: ArrowDown,
    seeding: ArrowUp,
    queued: Clock,
    paused: Pause,
    stopped: CircleStop,
    checking: ScanLine,
    repairing: Wrench,
    extracting: PackageOpen,
    finishing: LoaderCircle,
    finished: CircleCheck,
    error: TriangleAlert,
  } as const satisfies Record<TaskStatus, unknown>;

  const statusIconColorClasses: Record<TaskStatus, string> = {
    downloading: "text-[var(--color-primary)]",
    checking: "text-[var(--color-primary)]",
    finishing: "text-[var(--color-primary)]",

    seeding: "text-[var(--color-success)]",
    finished: "text-[var(--color-success)]",

    error: "text-[var(--color-error)]",
    repairing: "text-[var(--color-warning)]",

    queued: "text-[var(--color-text-secondary)]",
    extracting: "text-[var(--color-text-secondary)]",
    paused: "text-[var(--color-text-secondary)]",
    stopped: "text-[var(--color-text-secondary)]",
  };

  const Icon = $derived(ICONS[status] ?? Circle);
</script>

<Icon class={["w-[14px] h-[14px]", statusIconColorClasses[status]]} aria-hidden="true" />
