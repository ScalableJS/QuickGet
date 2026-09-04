import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("applyTheme", () => {
  let listeners: ((e: unknown) => void)[] = [];
  let matchesDark = false;

  beforeEach(() => {
    listeners = [];
    matchesDark = false;
    document.documentElement.removeAttribute("data-theme");

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        get matches() {
          return matchesDark;
        },
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_event: string, cb: (e: unknown) => void) => {
          listeners.push(cb);
        }),
        removeEventListener: vi.fn((_event: string, cb: (e: unknown) => void) => {
          listeners = listeners.filter((l) => l !== cb);
        }),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("applies light theme explicitly", async () => {
    const { applyTheme } = await import("./applyTheme");
    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("applies dark theme explicitly", async () => {
    const { applyTheme } = await import("./applyTheme");
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("applies auto theme based on OS media preference (light)", async () => {
    vi.resetModules();
    matchesDark = false;
    const { applyTheme } = await import("./applyTheme");
    applyTheme("auto");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("applies auto theme based on OS media preference (dark)", async () => {
    vi.resetModules();
    matchesDark = true;
    const { applyTheme } = await import("./applyTheme");
    applyTheme("auto");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("reacts dynamically to OS media preference change when on auto", async () => {
    vi.resetModules();
    matchesDark = false;
    const { applyTheme } = await import("./applyTheme");
    applyTheme("auto");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    matchesDark = true;
    for (const listener of listeners) {
      listener({ matches: true });
    }
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("removes previous listener when changing away from auto", async () => {
    vi.resetModules();
    const { applyTheme } = await import("./applyTheme");
    applyTheme("auto");
    expect(listeners.length).toBeGreaterThan(0);
    applyTheme("dark");
    expect(listeners.length).toBe(0);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
