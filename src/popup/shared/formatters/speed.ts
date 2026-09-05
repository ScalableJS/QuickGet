export function formatRate(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "0B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  let value = bytesPerSecond;
  let unit = 0;
  if (value >= 1000 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const precision = unit === 0 || value >= 100 ? 0 : 1;
  let formatted = value.toFixed(precision);
  if (parseFloat(formatted) >= 1000 && unit < units.length - 1) {
    unit += 1;
    formatted = "1.0";
  } else if (formatted.endsWith(".0") && parseFloat(formatted) >= 100) {
    formatted = parseFloat(formatted).toFixed(0);
  }
  return `${formatted}${units[unit]}`;
}
