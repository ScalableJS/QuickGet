/**
 * Theme application — resolves a ThemeMode to a concrete `data-theme` attribute
 * on <html>. For "auto" it follows the OS color-scheme and reacts to live changes.
 */

import type { ThemeMode } from "./config.js";

const media = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

let autoListener: ((e: MediaQueryListEvent) => void) | null = null;

function setAttr(resolved: "light" | "dark"): void {
  document.documentElement.setAttribute("data-theme", resolved);
}

/**
 * Apply the given theme preference to the document. Idempotent — safe to call on
 * every settings change. Installs/removes the OS listener depending on "auto".
 */
export function applyTheme(theme: ThemeMode): void {
  // Drop any previous auto listener before re-evaluating.
  if (autoListener && media) {
    media.removeEventListener("change", autoListener);
    autoListener = null;
  }

  if (theme === "auto") {
    const resolve = (): void => setAttr(media?.matches ? "dark" : "light");
    resolve();
    if (media) {
      autoListener = resolve;
      media.addEventListener("change", autoListener);
    }
    return;
  }

  setAttr(theme);
}
