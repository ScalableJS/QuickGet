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
    host.style.top = "16px";
    host.style.right = "20px";
    host.style.pointerEvents = "auto";
    document.body.appendChild(host);
  }

  let shadow = host.shadowRoot;
  if (!shadow) {
    shadow = host.attachShadow({ mode: "open" });
  }

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
        flex-direction: column;
        gap: 8px;
        min-width: 270px;
        max-width: 380px;
        padding: 12px 14px;
        background: #0f1e32;
        color: #e8eef7;
        border: 1px solid #263e5e;
        border-radius: 8px;
        box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.5), 0 4px 10px -2px rgba(0, 0, 0, 0.3);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.4;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        color: #728197;
        padding-bottom: 2px;
      }
      .btn-dismiss {
        background: transparent;
        border: none;
        color: #728197;
        font-size: 14px;
        cursor: pointer;
        padding: 0 2px;
        line-height: 1;
        border-radius: 3px;
      }
      .btn-dismiss:hover {
        color: #e8eef7;
        background: rgba(255, 255, 255, 0.08);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .status-icon {
        flex-shrink: 0;
      }
      .msg {
        flex: 1;
        font-size: 13px;
        color: #f1f5f9;
        word-break: break-word;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 4px;
        justify-content: flex-end;
      }
      .actions button {
        border-radius: 5px;
        padding: 5px 11px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 500;
        transition: background 0.15s, border-color 0.15s;
      }
      .btn-local {
        background: #306edc;
        border: 1px solid #3a82f7;
        color: #ffffff;
      }
      .btn-local:hover {
        background: #255fc6;
      }
      .btn-retry {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #e8eef7;
      }
      .btn-retry:hover {
        background: rgba(255, 255, 255, 0.16);
      }
    </style>
    <div class="toast" role="alert">
      <div class="header">
        <span>QuickGet Remote</span>
        <button id="qg-dismiss" class="btn-dismiss" type="button" title="Close" aria-label="Close">✕</button>
      </div>
      <div class="row">
        ${iconSvg}
        <span class="msg">${message}</span>
      </div>
      ${
        state === "error"
          ? `<div class="actions">
              <button id="qg-open-local" class="btn-local" type="button">Open locally</button>
              ${options?.onRetry ? '<button id="qg-retry" class="btn-retry" type="button">Retry</button>' : ""}
            </div>`
          : ""
      }
    </div>
  `;

  const dismissBtn = shadow.getElementById("qg-dismiss");
  dismissBtn?.addEventListener("click", () => {
    host?.remove();
  });

  if (state === "error") {
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
          showFeedback("success", "Added to QNAP Download Station");
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
        typeof items?.autoCaptureMagnets === "boolean" ? items.autoCaptureMagnets : DEFAULTS.autoCaptureMagnets;
      updateListener(enabled);
    });

    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void => {
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
