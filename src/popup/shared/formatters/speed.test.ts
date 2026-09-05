import { describe, expect, it } from "vitest";
import { formatRate } from "./speed.js";

describe("formatRate", () => {
  it("formats zero and negative speeds", () => {
    expect(formatRate(0)).toBe("0 B/s");
    expect(formatRate(-10)).toBe("0 B/s");
    expect(formatRate(NaN)).toBe("0 B/s");
  });

  it("never outputs more than 3 digits across all scales", () => {
    const cases = [
      0, 1, 9, 10, 99, 100, 999, 1000, 1023, 1024, 1500, 9999, 10240, 12500, 99900,
      102400, 524288, 1048576, 5242880, 15938355, 104857600, 524288000, 1073741824,
      1024 * 1024 * 99.96, 1024 * 1024 * 125,
    ];

    for (const bytes of cases) {
      const formatted = formatRate(bytes);
      const valuePart = formatted.split(" ")[0];
      const digitCount = valuePart.replace(/[^0-9]/g, "").length;
      expect(digitCount).toBeLessThanOrEqual(3);
    }
  });

  it("formats specific scales cleanly without unnecessary .0 for values >= 100", () => {
    expect(formatRate(500)).toBe("500 B/s");
    expect(formatRate(1024)).toBe("1.0 KB/s");
    expect(formatRate(102400)).toBe("100 KB/s");
    expect(formatRate(524288)).toBe("512 KB/s");
    expect(formatRate(1048576)).toBe("1.0 MB/s");
    expect(formatRate(104857600)).toBe("100 MB/s");
    expect(formatRate(131072000)).toBe("125 MB/s");
    expect(formatRate(1073741824)).toBe("1.0 GB/s");
  });
});
