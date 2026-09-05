<script lang="ts">
  import ArrowDown from "~icons/lucide/arrow-down";
  import ArrowUp from "~icons/lucide/arrow-up";
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
    { label: "100 KB/s (3 digits, no .0)", bytes: 102400 },
    { label: "512 KB/s", bytes: 524288 },
    { label: "1.0 MB/s", bytes: 1048576 },
    { label: "5.0 MB/s", bytes: 5242880 },
    { label: "15.2 MB/s", bytes: 15938355 },
    { label: "Boundary 99.9 MB/s", bytes: 104752742 },
    { label: "100 MB/s (3 digits, no .0)", bytes: 104857600 },
    { label: "125 MB/s", bytes: 131072000 },
    { label: "500 MB/s", bytes: 524288000 },
    { label: "1.0 GB/s", bytes: 1073741824 },
    { label: "1.2 GB/s", bytes: 1288490188 },
  ];

  function getDigitCount(formatted: string): number {
    const valuePart = formatted.split(" ")[0] ?? "";
    return valuePart.replace(/[^0-9]/g, "").length;
  }
</script>

<div class="p-4 bg-[var(--color-bg)] text-[var(--color-text)] font-sans max-w-[650px] space-y-4">
  <div>
    <h2 class="text-16px font-600 m-0 mb-1">Speed Telemetry & Format Matrix</h2>
    <p class="text-12px text-[var(--color-text-secondary)] m-0">
      Demonstrates zero-gap icon rendering, no borders, and strict cap to at most 3 digits across all scales.
    </p>
  </div>

  <div class="border border-[var(--color-control-border)] rounded-[var(--radius)] overflow-hidden">
    <table class="w-full text-12px border-collapse">
      <thead>
        <tr class="bg-[var(--color-bg-alt)] text-left border-b border-[var(--color-control-border)]">
          <th class="p-2 font-600">Case</th>
          <th class="p-2 font-600">Formatted</th>
          <th class="p-2 font-600">Digits</th>
          <th class="p-2 font-600">Toolbar Header Style</th>
          <th class="p-2 font-600">Card Item Style</th>
        </tr>
      </thead>
      <tbody>
        {#each speedTestCases as item}
          {@const formatted = formatRate(item.bytes)}
          {@const digits = getDigitCount(formatted)}
          <tr class="border-b border-[var(--color-control-border)] last:border-0 hover:bg-[var(--bg-hover)]">
            <td class="p-2 text-[var(--color-text-secondary)]">{item.label}</td>
            <td class="p-2 font-mono font-600 tabular-nums">{formatted}</td>
            <td class="p-2">
              <span class={["px-1.5 py-0.5 rounded text-10px font-600", digits <= 3 ? "bg-[var(--status-success-bg)] text-[var(--color-success)]" : "bg-[var(--status-error-bg)] text-[var(--color-error)]"]}>
                {digits} {digits === 1 ? "digit" : "digits"}
              </span>
            </td>
            <td class="p-2">
              <!-- Toolbar header compact speed rendering: no border, zero gap between arrow and number -->
              <span class="inline-flex items-center gap-2 text-11px font-500 py-0.5 select-none tabular-nums [&>svg]:w-3 [&>svg]:h-3">
                <span class="inline-flex items-center text-[var(--color-primary-visual)]">
                  <ArrowDown aria-hidden="true" class="flex-none" /><span>{formatted}</span>
                </span>
                <span class="inline-flex items-center text-[var(--progress-fill-seeding)]">
                  <ArrowUp aria-hidden="true" class="flex-none" /><span>{formatted}</span>
                </span>
              </span>
            </td>
            <td class="p-2">
              <!-- DownloadItem card speed rendering: zero gap between arrow and number -->
              <span class="inline-flex items-center text-[var(--color-primary-visual)] text-12px font-500 tabular-nums [&>svg]:w-3 [&>svg]:h-3">
                <ArrowDown aria-hidden="true" class="flex-none" />
                <span>{formatted}</span>
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
