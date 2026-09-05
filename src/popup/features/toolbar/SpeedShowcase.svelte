<script lang="ts">
  import { SpeedTelemetry } from "@ui";
  import { formatRate } from "../../shared/formatters";

  const speedTestCases: { label: string; bytes: number }[] = [
    { label: "Zero", bytes: 0 },
    { label: "1 digit bytes", bytes: 5 },
    { label: "2 digits bytes", bytes: 50 },
    { label: "3 digits bytes", bytes: 500 },
    { label: "Boundary 999 B/s", bytes: 999 },
    { label: "Boundary 1000 B/s (-> 1.0 KB/s)", bytes: 1000 },
    { label: "Boundary 1023 B/s (-> 1.0 KB/s)", bytes: 1023 },
    { label: "1.0 KB/s", bytes: 1024 },
    { label: "1.5 KB/s", bytes: 1536 },
    { label: "10.0 KB/s", bytes: 10240 },
    { label: "12.5 KB/s", bytes: 12800 },
    { label: "100 KB/s (no .0)", bytes: 102400 },
    { label: "512 KB/s", bytes: 524288 },
    { label: "1.0 MB/s", bytes: 1048576 },
    { label: "5.0 MB/s", bytes: 5242880 },
    { label: "15.2 MB/s", bytes: 15938355 },
    { label: "Boundary 99.9 MB/s", bytes: 104752742 },
    { label: "100 MB/s (no .0)", bytes: 104857600 },
    { label: "125 MB/s", bytes: 131072000 },
    { label: "500 MB/s", bytes: 524288000 },
    { label: "1.0 GB/s", bytes: 1073741824 },
    { label: "1.2 GB/s", bytes: 1288490188 },
  ];

  function getDigitCount(formatted: string): number {
    const valuePart = formatted.split(/[A-Za-z]/)[0] ?? "";
    return valuePart.replace(/[^0-9]/g, "").length;
  }
</script>

<svelte:head>
  <style>
    body {
      width: 100% !important;
      max-width: 100% !important;
      max-height: none !important;
    }
  </style>
</svelte:head>

<div class="p-4 bg-[var(--color-bg)] text-[var(--color-text)] font-sans space-y-3 max-w-[800px]">
  <div>
    <h2 class="text-14px font-600 m-0 mb-1">Speed Telemetry & Format Matrix</h2>
    <p class="text-11px text-[var(--color-text-secondary)] m-0 leading-tight">
      Zero-gap icons, borderless header, and strictly ≤ 3 digits across all scales.
    </p>
  </div>

  <div class="border border-[var(--color-control-border)] rounded-[var(--radius)] overflow-x-auto">
    <table class="w-full text-11px border-collapse">
      <thead>
        <tr class="bg-[var(--color-bg-alt)] text-left border-b border-[var(--color-control-border)]">
          <th class="py-1.5 px-2 font-600 whitespace-nowrap">Format & Case</th>
          <th class="py-1.5 px-1.5 font-600 whitespace-nowrap text-center">Digits</th>
          <th class="py-1.5 px-2 font-600 whitespace-nowrap">Header Preview</th>
          <th class="py-1.5 px-2 font-600 whitespace-nowrap">Card</th>
        </tr>
      </thead>
      <tbody>
        {#each speedTestCases as item}
          {@const formatted = formatRate(item.bytes)}
          {@const digits = getDigitCount(formatted)}
          <tr class="border-b border-[var(--color-control-border)] last:border-0 hover:bg-[var(--bg-hover)]">
            <td class="py-1 px-2 whitespace-nowrap">
              <span class="font-mono font-600 text-11px tabular-nums">{formatted}</span>
              <span class="text-10px text-[var(--color-text-muted)] block leading-tight">{item.label}</span>
            </td>
            <td class="py-1 px-1.5 text-center whitespace-nowrap">
              <span class={["px-1 py-0.5 rounded text-9px font-600", digits <= 3 ? "bg-[var(--status-success-bg)] text-[var(--color-success)]" : "bg-[var(--status-error-bg)] text-[var(--color-error)]"]}>
                {digits}d
              </span>
            </td>
            <td class="py-1 px-2 whitespace-nowrap">
              <!-- Toolbar header compact speed rendering via SpeedTelemetry element -->
              <SpeedTelemetry down={formatted} up={formatted} />
            </td>
            <td class="py-1 px-2 whitespace-nowrap">
              <!-- DownloadItem card speed rendering via SpeedTelemetry element -->
              <SpeedTelemetry direction="down" value={formatted} class="text-11px font-500" />
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
