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
        <button id="status-dismiss" type="button" class="hidden">Dismiss message</button>
      </div>
    `;
  });

  afterEach(() => {
    clearStatus();
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

  it("does not let a polling failure replace direct feedback before its TTL", () => {
    showStatus("Settings saved", "success", { autoHideMs: 2500 });
    showStatus("Failed to list downloads: offline", "error", { owner: "poll" });

    expect(document.getElementById("status-message")?.textContent).toBe("Settings saved");
    expect(document.getElementById("status")?.getAttribute("aria-live")).toBe("polite");
  });

  it("clears recovered polling feedback without clearing direct feedback", () => {
    showStatus("Failed to list downloads: offline", "error", { owner: "poll" });
    clearStatus({ owner: "poll" });
    expect(document.querySelector(".status-bar")?.classList.contains("hidden")).toBe(true);

    showStatus("Connected to the NAS", "success", { autoHideMs: 2500 });
    clearStatus({ owner: "poll" });
    expect(document.getElementById("status-message")?.textContent).toBe("Connected to the NAS");
  });

  it("does not re-announce an unchanged polling failure", () => {
    showStatus("Failed to list downloads: offline", "error", { owner: "poll" });
    const pill = document.getElementById("status");
    if (!pill) throw new Error("status pill is missing");
    const setAttribute = vi.spyOn(pill, "setAttribute");

    showStatus("Failed to list downloads: offline", "error", { owner: "poll" });

    expect(setAttribute).not.toHaveBeenCalled();
  });

  it("preserves a newer timed confirmation until its own timer expires", () => {
    showStatus("First accepted", "success", { autoHideMs: 2500 });
    vi.advanceTimersByTime(1000);
    showStatus("Second accepted", "success", { autoHideMs: 4000 });

    vi.advanceTimersByTime(1500);
    expect(document.getElementById("status-message")?.textContent).toBe("Second accepted");
    vi.advanceTimersByTime(2500);
    expect(document.querySelector(".status-bar")?.classList.contains("hidden")).toBe(true);
  });

  it("preserves a newer persistent error when an old confirmation timer expires", () => {
    showStatus("Accepted", "success", { autoHideMs: 2500 });
    vi.advanceTimersByTime(500);
    showStatus("Current operation failed", "error");

    vi.advanceTimersByTime(10_000);
    expect(document.getElementById("status-message")?.textContent).toBe("Current operation failed");
  });

  it("dismisses a polling episode until recovery and allows a direct dismissal to reveal poll health", () => {
    showStatus("Failed to list downloads: offline", "error", { owner: "poll" });
    document.getElementById("status-dismiss")?.click();
    showStatus("Failed to list downloads: offline", "error", { owner: "poll" });
    expect(document.querySelector(".status-bar")?.classList.contains("hidden")).toBe(true);

    clearStatus({ owner: "poll" });
    showStatus("Failed to list downloads: offline", "error", { owner: "poll" });
    expect(document.getElementById("status-message")?.textContent).toBe("Failed to list downloads: offline");

    showStatus("Direct failure", "error");
    document.getElementById("status-dismiss")?.click();
    showStatus("Failed to list downloads: offline", "error", { owner: "poll" });
    expect(document.getElementById("status-message")?.textContent).toBe("Failed to list downloads: offline");
  });

  it("shows a changed polling failure after dismissing an older failure in the same episode", () => {
    showStatus("Failed to list downloads: offline", "error", { owner: "poll" });
    document.getElementById("status-dismiss")?.click();

    showStatus("Failed to list downloads: denied", "error", { owner: "poll" });
    showStatus("Failed to list downloads: offline", "error", { owner: "poll" });

    expect(document.getElementById("status-message")?.textContent).toBe("Failed to list downloads: offline");
  });

  it("resets a dismissed polling episode for a replacement connection without clearing direct feedback", () => {
    showStatus("Failed to list downloads: offline", "error", { owner: "poll" });
    document.getElementById("status-dismiss")?.click();

    showStatus("Settings saved", "success", { autoHideMs: 2500 });
    clearStatus({ owner: "poll" });
    expect(document.getElementById("status-message")?.textContent).toBe("Settings saved");

    document.getElementById("status-dismiss")?.click();
    showStatus("Failed to list downloads: offline", "error", { owner: "poll" });
    expect(document.getElementById("status-message")?.textContent).toBe("Failed to list downloads: offline");
  });
});
