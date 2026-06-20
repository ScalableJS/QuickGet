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

  const Icon = $derived(ICONS[status] ?? Circle);
</script>

<!-- Colour comes from .progress-icon[data-status] (the torrent-client colour cue). -->
<Icon class="status-icon" aria-hidden="true" />
