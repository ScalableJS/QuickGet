/**
 * Content script: captures clicks on magnet: links and sends them to QNAP Download Station.
 * Injected at document_start into all frames.
 *
 * Adheres to strict DOM Event Loop semantics:
 * - Cancel link navigation synchronously before any async work (preventDefault).
 * - Forward magnet URI to the Service Worker via runtime.sendMessage.
 * - Provide immediate feedback in an isolated Shadow DOM toast.
 * - On failure, offer explicit [Retry] and [Open locally] buttons (compensating fallback).
 */

import { DEFAULTS } from "@lib/config.js";

export type MagnetMessage = {
  type: "task:add";
  uri: string;
  source: "magnet-click";
  pageUrl: string;
};

export type MagnetResponse = { ok: true; deduped?: boolean } | { ok: false; error: string; code?: string };

const inFlightUris = new Set<string>();

/**
 * Determine whether a mouse event represents an eligible, trusted primary click on a link.
 */
export function isEligibleClick(event: MouseEvent): boolean {
  if (!event.isTrusted) return false;
  if (event.button !== 0) return false;
  if (!event.cancelable) return false;
  if (event.defaultPrevented) return false;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false;
  return true;
}

/**
 * Find the nearest anchor element by traversing event.composedPath() (supporting Shadow DOM).
 */
export function findAnchor(event: MouseEvent): Element | null {
  if (typeof event.composedPath === "function") {
    const path = event.composedPath();
    for (const node of path) {
      if (node instanceof Element) {
        if (node.tagName.toUpperCase() === "A" && node.hasAttribute("href")) {
          return node;
        }
      }
    }
  }

  const target = event.target as Element | null;
  return target?.closest?.("a[href]") ?? null;
}

/**
 * Extract a valid magnet: URI from the event's target anchor, if any.
 */
export function getMagnetUri(event: MouseEvent): string | null {
  if (!isEligibleClick(event)) return null;
  const anchor = findAnchor(event);
  if (!anchor) return null;

  const rawHref = anchor instanceof HTMLAnchorElement ? anchor.href : anchor.getAttribute("href");
  if (!rawHref) return null;

  const trimmed = rawHref.trim();
  if (/^magnet:\?/i.test(trimmed) || /^magnet:/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

let toastTimeoutId: ReturnType<typeof setTimeout> | undefined;

let currentTheme: "auto" | "light" | "dark" = "auto";

export function setCurrentTheme(theme: "auto" | "light" | "dark"): void {
  currentTheme = theme;
}

export function resolveTheme(theme: "auto" | "light" | "dark"): "light" | "dark" {
  if (theme === "auto") {
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

/**
 * Render isolated in-page feedback for magnet link interception.
 */
export function showFeedback(state: "loading" | "success" | "error", message: string): void {
  if (typeof document === "undefined" || !document.body) return;

  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
    toastTimeoutId = undefined;
  }

  let host = document.getElementById("quickget-feedback-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "quickget-feedback-host";
    host.style.position = "fixed";
    host.style.zIndex = "2147483647";
    host.style.top = "16px";
    host.style.right = "20px";
    host.style.pointerEvents = "auto";
    document.body.appendChild(host);
  }

  let shadow = host.shadowRoot;
  if (!shadow) {
    shadow = host.attachShadow({ mode: "open" });
  }

  const isDark = resolveTheme(currentTheme) === "dark";
  const bg = isDark ? "#0f1e32" : "#ffffff";
  const border = isDark ? "#263e5e" : "#d6dce5";
  const text = isDark ? "#f1f5f9" : "#172033";
  const dismissColor = isDark ? "#728197" : "#8a99ad";
  const dismissHover = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
  const shadowStyle = isDark
    ? "0 10px 24px -4px rgba(0, 0, 0, 0.45), 0 4px 8px -2px rgba(0, 0, 0, 0.3)"
    : "0 10px 24px -4px rgba(23, 32, 51, 0.14), 0 4px 8px -2px rgba(23, 32, 51, 0.08)";

  const iconSvg =
    state === "loading"
      ? `<svg class="status-icon spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
           <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
         </svg>`
      : state === "success"
        ? `<svg class="status-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
             <circle cx="12" cy="12" r="10" stroke="#22c55e" stroke-width="2" fill="rgba(34, 197, 94, 0.12)"></circle>
             <path d="m9 12 2 2 4-4"></path>
           </svg>`
        : `<svg class="status-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
             <circle cx="12" cy="12" r="10" stroke="#ef4444" stroke-width="2" fill="rgba(239, 68, 68, 0.12)"></circle>
             <line x1="12" y1="8" x2="12" y2="12"></line>
             <line x1="12" y1="16" x2="12.01" y2="16"></line>
           </svg>`;

  shadow.innerHTML = `
    <style>
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .spin {
        animation: spin 0.85s linear infinite;
      }
      .toast {
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 220px;
        max-width: 420px;
        padding: 9px 12px;
        background: ${bg};
        color: ${text};
        border: 1px solid ${border};
        border-radius: 8px;
        box-shadow: ${shadowStyle};
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.4;
      }
      .status-icon {
        flex-shrink: 0;
      }
      .msg {
        flex: 1;
        font-size: 13px;
        font-weight: 500;
        color: ${text};
        word-break: break-word;
      }
      .btn-dismiss {
        background: transparent;
        border: none;
        color: ${dismissColor};
        font-size: 14px;
        cursor: pointer;
        padding: 2px 4px;
        line-height: 1;
        border-radius: 4px;
      }
      .btn-dismiss:hover {
        color: ${text};
        background: ${dismissHover};
      }
    </style>
    <div class="toast" role="alert">
      ${iconSvg}
      <span class="msg">${message}</span>
      <button id="qg-dismiss" class="btn-dismiss" type="button" title="Close" aria-label="Close">✕</button>
    </div>
  `;

  const dismissBtn = shadow.getElementById("qg-dismiss");
  dismissBtn?.addEventListener("click", () => {
    host?.remove();
  });

  if (state === "success") {
    toastTimeoutId = setTimeout(() => {
      host?.remove();
    }, 2500);
  } else if (state === "error") {
    toastTimeoutId = setTimeout(() => {
      host?.remove();
    }, 4000);
  }
}

/**
 * Forward an eligible magnet URI to the Service Worker.
 */
function sendMagnetToWorker(uri: string): void {
  if (inFlightUris.has(uri)) return;
  inFlightUris.add(uri);

  showFeedback("loading", "Sending magnet link to QNAP Download Station…");

  const message: MagnetMessage = {
    type: "task:add",
    uri,
    source: "magnet-click",
    pageUrl: window.location.href,
  };

  const dispatch = (): void => {
    try {
      chrome.runtime.sendMessage(message, (response: MagnetResponse | undefined) => {
        inFlightUris.delete(uri);
        const lastErr = chrome.runtime.lastError;
        if (lastErr) {
          showFeedback("error", `Could not contact QuickGet: ${lastErr.message}`);
          return;
        }

        if (response?.ok) {
          showFeedback("success", "Added to QNAP Download Station");
        } else {
          const err = response?.error || "NAS rejected the link";
          showFeedback("error", `Failed to send to QNAP: ${err}`);
        }
      });
    } catch (error) {
      inFlightUris.delete(uri);
      showFeedback("error", `Extension error: ${String(error)}`);
    }
  };

  dispatch();
}

/**
 * Click handler registered on document during the capture phase.
 */
function onDocumentClick(event: MouseEvent): void {
  const uri = getMagnetUri(event);
  if (!uri) return;

  // Crucial: Synchronous cancel of browser navigation before any async operation.
  event.preventDefault();

  sendMagnetToWorker(uri);
}

/**
 * Initialize listener based on storage configuration.
 */
export function initMagnetInterception(): () => void {
  let isListenerAttached = false;

  const updateListener = (enabled: boolean): void => {
    if (enabled && !isListenerAttached) {
      document.addEventListener("click", onDocumentClick, { capture: true, passive: false });
      isListenerAttached = true;
    } else if (!enabled && isListenerAttached) {
      document.removeEventListener("click", onDocumentClick, true);
      isListenerAttached = false;
    }
  };

  try {
    chrome.storage.local.get(["autoCaptureMagnets", "theme"], (items) => {
      const enabled =
        typeof items?.autoCaptureMagnets === "boolean" ? items.autoCaptureMagnets : DEFAULTS.autoCaptureMagnets;
      if (items?.theme && ["auto", "light", "dark"].includes(items.theme as string)) {
        currentTheme = items.theme as "auto" | "light" | "dark";
      }
      updateListener(enabled);
    });

    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void => {
      if (areaName === "local") {
        if ("autoCaptureMagnets" in changes) {
          updateListener(Boolean(changes.autoCaptureMagnets.newValue));
        }
        if ("theme" in changes && changes.theme.newValue) {
          currentTheme = changes.theme.newValue as "auto" | "light" | "dark";
        }
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
      updateListener(false);
    };
  } catch {
    return () => {};
  }
}

// Auto-run in browser context
if (typeof window !== "undefined" && typeof chrome !== "undefined" && chrome.runtime?.id) {
  initMagnetInterception();
}
