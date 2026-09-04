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

export type MagnetResponse =
  | { ok: true; deduped?: boolean }
  | { ok: false; error: string; code?: string };

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

/**
 * Render isolated in-page feedback for magnet link interception.
 */
export function showFeedback(
  state: "loading" | "success" | "error",
  message: string,
  options?: { magnetUri?: string; onRetry?: () => void },
): void {
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
    host.style.bottom = "24px";
    host.style.right = "24px";
    host.style.pointerEvents = "auto";
    document.body.appendChild(host);
  }

  let shadow = host.shadowRoot;
  if (!shadow) {
    shadow = host.attachShadow({ mode: "open" });
  }

  const bg = state === "error" ? "#7f1d1d" : state === "success" ? "#14532d" : "#1e293b";
  const border = state === "error" ? "#ef4444" : state === "success" ? "#22c55e" : "#475569";
  const icon = state === "loading" ? "⏳" : state === "success" ? "✓" : "⚠";

  shadow.innerHTML = `
    <style>
      .toast {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 260px;
        max-width: 380px;
        padding: 12px 16px;
        background: ${bg};
        color: #f8fafc;
        border: 1px solid ${border};
        border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.4;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 4px;
        justify-content: flex-end;
      }
      button {
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: 4px;
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 500;
      }
      button:hover {
        background: rgba(255, 255, 255, 0.25);
      }
      .btn-local {
        background: #2563eb;
        border-color: #3b82f6;
      }
      .btn-local:hover {
        background: #1d4ed8;
      }
    </style>
    <div class="toast" role="alert">
      <div class="row">
        <span>${icon}</span>
        <span style="flex: 1;">${message}</span>
      </div>
      ${
        state === "error"
          ? `<div class="actions">
              <button id="qg-open-local" class="btn-local" type="button">Open locally</button>
              ${options?.onRetry ? '<button id="qg-retry" type="button">Retry</button>' : ""}
              <button id="qg-dismiss" type="button">✕</button>
            </div>`
          : ""
      }
    </div>
  `;

  if (state === "error") {
    const dismissBtn = shadow.getElementById("qg-dismiss");
    dismissBtn?.addEventListener("click", () => {
      host?.remove();
    });

    const openLocalBtn = shadow.getElementById("qg-open-local");
    openLocalBtn?.addEventListener("click", () => {
      if (options?.magnetUri) {
        window.location.href = options.magnetUri;
      }
      host?.remove();
    });

    const retryBtn = shadow.getElementById("qg-retry");
    retryBtn?.addEventListener("click", () => {
      if (options?.onRetry) {
        options.onRetry();
      }
    });
  } else if (state === "success") {
    toastTimeoutId = setTimeout(() => {
      host?.remove();
    }, 2500);
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
          showFeedback("error", `Could not contact QuickGet: ${lastErr.message}`, {
            magnetUri: uri,
            onRetry: () => sendMagnetToWorker(uri),
          });
          return;
        }

        if (response?.ok) {
          showFeedback("success", "✓ Added to QNAP Download Station");
        } else {
          const err = response?.error || "NAS rejected the link";
          showFeedback("error", `Failed to send to QNAP: ${err}`, {
            magnetUri: uri,
            onRetry: () => sendMagnetToWorker(uri),
          });
        }
      });
    } catch (error) {
      inFlightUris.delete(uri);
      showFeedback("error", `Extension error: ${String(error)}`, {
        magnetUri: uri,
        onRetry: () => sendMagnetToWorker(uri),
      });
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
    chrome.storage.local.get("autoCaptureMagnets", (items) => {
      const enabled =
        typeof items?.autoCaptureMagnets === "boolean"
          ? items.autoCaptureMagnets
          : DEFAULTS.autoCaptureMagnets;
      updateListener(enabled);
    });

    const storageListener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ): void => {
      if (areaName === "local" && "autoCaptureMagnets" in changes) {
        const next = Boolean(changes.autoCaptureMagnets.newValue);
        updateListener(next);
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
