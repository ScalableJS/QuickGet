import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { CDPSession } from "@playwright/test";

/**
 * The extension's id is fixed by the `key` in `manifest.json`, so it is the same in every profile
 * and matches the Web Store listing. Recomputed from that key, not copied from a URL.
 */
export const EXTENSION_ID = "hdeipkdkjejfhbdmcejlgdccpocfbbcm";

/** 1920x1080 master, 16:9. The recording display is 3440x1440 and not HiDPI, so this fits 1:1. */
export const DEMO_WINDOW = { width: 1920, height: 1080, left: 0, top: 0 } as const;

export interface DemoProfileOptions {
  /** Defaults to a fresh temporary directory. */
  userDataDir?: string;
  /** Extra `Preferences` entries merged over the pinning seed. */
  preferences?: Record<string, unknown>;
}

/**
 * Creates a Chrome profile with the QuickGet icon already pinned to the toolbar.
 *
 * The toolbar icon is the demo's proof that interception happened, so it must be visible before
 * recording starts. `chrome.action` cannot pin it — `getUserSettings()` is a getter and Chrome
 * treats pinning as a user setting — but seeding the profile's `Preferences` before first launch
 * does work.
 *
 * Verified 2026-08-31: with `extensions.pinned_extensions` seeded, `getUserSettings()` reports
 * `isOnToolbar: true` on a profile that has never been opened by hand; an unseeded control
 * reports `false`. That removes the hand-pinned template profile DEMO-4 originally assumed.
 */
export async function createDemoProfile(options: DemoProfileOptions = {}): Promise<string> {
  const userDataDir = options.userDataDir ?? (await mkdtemp(path.join(tmpdir(), "quickget-demo-")));

  await mkdir(path.join(userDataDir, "Default"), { recursive: true });
  await writeFile(
    path.join(userDataDir, "Default", "Preferences"),
    JSON.stringify({
      extensions: { pinned_extensions: [EXTENSION_ID] },
      ...options.preferences,
    }),
    "utf8",
  );

  return userDataDir;
}

/**
 * Launch arguments for the demo run.
 *
 * The size flags are a starting hint only — see `placeDemoWindow()`. Playwright sets its own
 * viewport, which overrides them: a launch asking for 1920x1080 was granted 1282x846.
 */
export function demoWindowArgs(extensionPath: string, window: { left: number; top: number } = DEMO_WINDOW): string[] {
  return [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    `--window-position=${window.left},${window.top}`,
  ];
}

/**
 * Sizes and places the browser **window** through CDP, then reports what Chrome actually granted.
 *
 * Launch flags are not enough: Playwright's own viewport wins over `--window-size`, and even CDP
 * may adjust the request. The recording crop must use the returned numbers, never the requested
 * ones — the whole 16:9 framing depends on it.
 *
 * The *window* is the 1920x1080 target, not the viewport. Chrome's toolbar takes roughly 87px of
 * that height, and the toolbar is exactly what the demo needs in frame.
 *
 * Launch the context with `viewport: null`, or Playwright's viewport fights this and the window
 * comes back at its size instead. Verified 2026-08-31: with `viewport: null` a 1920x1080 request
 * is granted exactly (viewport 1920x993), and the window lands at `top: 30` because of the macOS
 * menu bar — which is why the capture crop must use these returned bounds rather than 0,0.
 */
export async function placeDemoWindow(
  cdp: CDPSession,
  window: { width: number; height: number; left: number; top: number } = DEMO_WINDOW,
): Promise<{ width: number; height: number; left: number; top: number }> {
  const { windowId } = await cdp.send("Browser.getWindowForTarget");
  await cdp.send("Browser.setWindowBounds", {
    windowId,
    bounds: { ...window, windowState: "normal" },
  });

  const { bounds } = await cdp.send("Browser.getWindowBounds", { windowId });
  return {
    width: bounds.width ?? window.width,
    height: bounds.height ?? window.height,
    left: bounds.left ?? window.left,
    top: bounds.top ?? window.top,
  };
}
