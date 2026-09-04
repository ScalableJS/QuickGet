import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearStatus, showStatus } from "./statusPill";

describe("statusPill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div class="status-bar hidden">
        <div id="status" class="hidden">
          <span id="status-message"></span>
        </div>
      </div>
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("does nothing when DOM elements are missing", () => {
    document.body.innerHTML = "";
    expect(() => showStatus("test")).not.toThrow();
    expect(() => clearStatus()).not.toThrow();
  });

  it("shows an info status and updates DOM and aria-live polite", () => {
    showStatus("Processing file", "info");

    const bar = document.querySelector(".status-bar");
    const pill = document.getElementById("status");
    const msg = document.getElementById("status-message");

    expect(msg?.textContent).toBe("Processing file");
    expect(pill?.getAttribute("aria-live")).toBe("polite");
    expect(pill?.className).toContain("bg-[var(--status-info-bg)]");
    expect(bar?.classList.contains("flex")).toBe(true);
    expect(bar?.classList.contains("hidden")).toBe(false);
  });

  it("shows an error status with assertive aria-live", () => {
    showStatus("Download failed", "error");

    const pill = document.getElementById("status");
    expect(pill?.getAttribute("aria-live")).toBe("assertive");
    expect(pill?.className).toContain("bg-[var(--status-error-bg)]");
  });

  it("hides status when empty message is passed", () => {
    showStatus("First message", "success");
    showStatus("", "info");

    const bar = document.querySelector(".status-bar");
    const pill = document.getElementById("status");

    expect(pill?.className).toContain("hidden");
    expect(bar?.classList.contains("hidden")).toBe(true);
  });

  it("clears status manually and resets timer", () => {
    showStatus("Done", "success", { autoHideMs: 3000 });
    clearStatus();

    const bar = document.querySelector(".status-bar");
    const pill = document.getElementById("status");
    const msg = document.getElementById("status-message");

    expect(msg?.textContent).toBe("");
    expect(pill?.className).toContain("hidden");
    expect(bar?.classList.contains("hidden")).toBe(true);
  });

  it("auto-hides after specified autoHideMs", () => {
    showStatus("Saved", "success", { autoHideMs: 1500 });

    const bar = document.querySelector(".status-bar");
    expect(bar?.classList.contains("hidden")).toBe(false);

    vi.advanceTimersByTime(1500);

    expect(bar?.classList.contains("hidden")).toBe(true);
  });
});
