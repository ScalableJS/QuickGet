/**
 * Content script: sends magnet and eligible ordinary-file clicks to QNAP Download Station.
 * Injected at document_start into all frames.
 *
 * Adheres to strict DOM Event Loop semantics:
 * - Magnet clicks are always claimed; a known rejection invokes the browser handler.
 * - Shift-click opts one ordinary file into sending while automatic file interception is off.
 * - Forward magnet URI to the Service Worker via runtime.sendMessage.
 * - Provide immediate feedback in an isolated Shadow DOM toast.
 * - Restore native handling only for known rejection or proven pre-dispatch failure.
 * - Unknown acceptance stays claimed so a lost reply cannot cause a duplicate download.
 */

import { DEFAULTS } from "@lib/config.js";
import { isDownloadableFileUrl, isTorrentSource } from "@lib/sourceKind.js";

export type MagnetMessage = {
  type: "task:add";
  uri: string;
  source: "magnet-click";
  pageUrl: string;
};

export type SendLinkMessage = {
  type: "link:send";
  url: string;
  pageUrl: string;
};

export type MagnetResponse = { ok: true; duplicate?: boolean } | { ok: false; error: string; code?: string };

type NativeFallback = {
  url: string;
  target: string;
  download: string | null;
};

const CONTENT_SCRIPT_CLEANUP_KEY = "quickget:magnet-content-cleanup";
const UI_REPLY_TIMEOUT_MS = 30_000;

/**
 * Determine whether a mouse event represents an eligible, trusted primary click on a link.
 *
 * Shift is allowed through because it opts one ordinary file into sending. Ctrl, Cmd and Alt keep
 * their native browser meanings.
 */
export function isEligibleClick(event: MouseEvent): boolean {
  if (!event.isTrusted) return false;
  if (event.button !== 0) return false;
  if (!event.cancelable) return false;
  if (event.defaultPrevented) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return true;
}

/**
 * The absolute URL of an eligible ordinary-file link, or `null` (RES-5).
 *
 * Two signals, both readable synchronously, because `preventDefault()` cannot wait for a network
 * round trip: the anchor's own `download` attribute — the page saying outright that this is a
 * file — or a known extension in the URL's path. Nothing here inspects a response; a link that
 * only reveals itself as a file through its `Content-Type` is left to the browser.
 *
 * The handler decides whether the file setting or Shift authorizes the send. Classification stays
 * independent of that choice so both paths use the same allow-list.
 */
export function getFileSendUrl(event: MouseEvent): string | null {
  if (!isEligibleClick(event)) return null;
  const anchor = findAnchor(event);
  if (!(anchor instanceof HTMLAnchorElement)) return null;

  const href = anchor.href;
  if (!href || !/^https?:/i.test(href)) return null;
  // A torrent belongs to the downloads API transaction, never the ordinary-file setting.
  if (isTorrentSource(href)) return null;

  if (anchor.hasAttribute("download")) return href;
  return isDownloadableFileUrl(href) ? href : null;
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

let feedbackRevision = 0;

// A page owns only its newest feedback. Transport claims are separate: an unanswered request
// remains claimed because Download Station may already have accepted it.
let feedbackOwner = 0;

const pendingDispatches = new Map<string, { owner: number; timeoutId: ReturnType<typeof setTimeout> }>();

let interceptionRevision = 0;

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
export function showFeedback(
  state: "loading" | "success" | "error",
  message: string,
  actions: Array<{ label: string; onClick: () => void }> = [],
  persistent = false,
): number {
  const revision = ++feedbackRevision;
  if (typeof document === "undefined" || !document.body) return revision;

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
      .btn-action {
        background: transparent;
        border: 1px solid ${border};
        border-radius: 4px;
        color: ${text};
        cursor: pointer;
        font: inherit;
        padding: 3px 6px;
      }
      .btn-action:hover {
        background: ${dismissHover};
      }
    </style>
    <div class="toast" role="alert">
      ${iconSvg}
      <span class="msg"></span>
      ${actions.map((_, index) => `<button id="qg-action-${index}" class="btn-action" type="button"></button>`).join("")}
      <button id="qg-dismiss" class="btn-dismiss" type="button" title="Close" aria-label="Close">✕</button>
    </div>
  `;

  const messageNode = shadow.querySelector(".msg");
  if (messageNode) messageNode.textContent = message;
  const dismissBtn = shadow.getElementById("qg-dismiss");
  dismissBtn?.addEventListener("click", () => {
    if (feedbackRevision !== revision) return;
    clearFeedback(host);
  });
  for (const [index, action] of actions.entries()) {
    const button = shadow.getElementById(`qg-action-${index}`);
    if (button) {
      button.textContent = action.label;
      button.addEventListener("click", action.onClick);
    }
  }

  if (state === "success") {
    toastTimeoutId = setTimeout(() => {
      if (feedbackRevision === revision) clearFeedback(host);
    }, 2500);
  } else if (state === "error" && actions.length === 0 && !persistent) {
    toastTimeoutId = setTimeout(() => {
      if (feedbackRevision === revision) clearFeedback(host);
    }, 4000);
  }

  return revision;
}

/**
 * Forward an eligible magnet URI to the Service Worker. The click is claimed before dispatch;
 * failure restores the browser's native magnet handler through normal navigation.
 */
function sendMagnetToWorker(uri: string, fallback: NativeFallback): void {
  const message: MagnetMessage = {
    type: "task:add",
    uri,
    source: "magnet-click",
    pageUrl: window.location.href,
  };
  sendToWorker(
    uri,
    fallback,
    message,
    (response) => `Failed to send: ${response?.error || "NAS rejected the link"}`,
    (error) => `Extension error: ${String(error)}`,
  );
}

/** Whether a plain click on an ordinary file link is sent to the NAS (RES-5). Off by default. */
let fileCaptureEnabled = DEFAULTS.interceptFileLinks;

export function setFileCaptureEnabled(enabled: boolean): void {
  fileCaptureEnabled = enabled;
}

/**
 * Replace any preceding content-script handler for this document execution.
 */
function installMagnetInterception(): void {
  if (typeof window === "undefined" || typeof chrome === "undefined" || !chrome.runtime?.id) return;

  const existingCleanup: unknown = Reflect.get(globalThis, CONTENT_SCRIPT_CLEANUP_KEY);
  if (typeof existingCleanup === "function") existingCleanup();
  Reflect.set(globalThis, CONTENT_SCRIPT_CLEANUP_KEY, initMagnetInterception());
}

/** Hand an ordinary file link to the worker through the same path as the context menu. */
function sendLinkToWorker(url: string, fallback: NativeFallback): void {
  const message: SendLinkMessage = { type: "link:send", url, pageUrl: window.location.href };
  sendToWorker(
    url,
    fallback,
    message,
    (response) => response?.error ?? "Could not send to Download Station",
    (error) => (error instanceof Error ? error.message : "Could not contact QuickGet"),
  );
}

function sendToWorker(
  url: string,
  fallback: NativeFallback,
  message: MagnetMessage | SendLinkMessage,
  rejectedMessage: (response: Extract<MagnetResponse, { ok: false }> | undefined) => string,
  thrownMessage: (error: unknown) => string,
): void {
  if (pendingDispatches.has(url)) return;
  const owner = ++feedbackOwner;
  showFeedback("loading", "Sending to Download Station…");

  const pending = {
    owner,
    timeoutId: setTimeout(() => {
      if (pendingDispatches.get(url)?.owner !== owner) return;
      showUnknownAcceptance(owner);
    }, UI_REPLY_TIMEOUT_MS),
  };
  pendingDispatches.set(url, pending);

  try {
    chrome.runtime.sendMessage(message, (response: MagnetResponse | undefined) => {
      if (pendingDispatches.get(url)?.owner !== owner) return;
      const lastErr = chrome.runtime.lastError;
      if (lastErr) {
        if (isNoReceivingEnd(lastErr.message ?? "")) {
          releaseDispatch(url, pending);
          fallBackToBrowser(fallback, `Could not contact QuickGet: ${lastErr.message ?? ""}`, owner);
        } else {
          showUnknownAcceptance(owner, lastErr.message);
        }
        return;
      }
      if (response?.ok) {
        releaseDispatch(url, pending);
        if (isCurrentFeedback(owner)) {
          showFeedback(
            "success",
            response.duplicate ? "Already exists on Download Station" : "Sent to Download Station",
          );
        }
        return;
      }
      if (response) {
        releaseDispatch(url, pending);
        fallBackToBrowser(fallback, rejectedMessage(response), owner);
      } else showUnknownAcceptance(owner);
    });
  } catch (error) {
    if (isPreDispatchInvalidation(error)) {
      releaseDispatch(url, pending);
      fallBackToBrowser(fallback, thrownMessage(error), owner);
    } else {
      showUnknownAcceptance(owner, error instanceof Error ? error.message : undefined);
    }
  }
}

function fallBackToBrowser(fallback: NativeFallback, message: string, owner: number): void {
  if (isCurrentFeedback(owner)) showFeedback("error", `${message}. Continuing in the browser.`);
  activateNativeFallback(fallback);
}

function showUnknownAcceptance(owner: number, detail?: string): void {
  if (!isCurrentFeedback(owner)) return;
  const suffix = detail ? ` (${detail})` : "";
  showFeedback(
    "error",
    `QuickGet could not confirm whether Download Station accepted this link${suffix}. Check Download Station before trying again.`,
    [],
    true,
  );
}

function releaseDispatch(url: string, pending: { owner: number; timeoutId: ReturnType<typeof setTimeout> }): void {
  clearTimeout(pending.timeoutId);
  if (pendingDispatches.get(url)?.owner === pending.owner) pendingDispatches.delete(url);
}

function isNoReceivingEnd(message: string): boolean {
  return /receiving end does not exist|could not establish connection[^.]*receiving end/i.test(message);
}

function isPreDispatchInvalidation(error: unknown): boolean {
  return error instanceof Error && /extension context invalidated/i.test(error.message);
}

/**
 * Click handler registered on document during the capture phase.
 *
 * Always attached because magnets are unconditional and Shift must work while automatic ordinary
 * file interception is off.
 */
function onDocumentClick(event: MouseEvent): void {
  const uri = getMagnetUri(event);
  if (uri) {
    const fallback = snapshotFallback(event, uri);
    claimLinkClick(event);
    sendMagnetToWorker(uri, fallback);
    return;
  }

  const fileUrl = getFileSendUrl(event);
  if (!fileUrl) return;
  if (!fileCaptureEnabled && !event.shiftKey) return;

  const fallback = snapshotFallback(event, fileUrl);
  claimLinkClick(event);
  sendLinkToWorker(fileUrl, fallback);
}

/**
 * A tracker can attach its own click handler that starts a download even when the anchor's
 * default navigation was cancelled. Once QuickGet claims a link, no page handler may create a
 * second browser outcome behind its back.
 */
function claimLinkClick(event: MouseEvent): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

/**
 * Initialize the unconditional magnet listener and the ordinary-file preference.
 */
export function initMagnetInterception(): () => void {
  const session = ++interceptionRevision;
  const onClick = (event: MouseEvent): void => {
    if (!chrome.runtime?.id) {
      document.removeEventListener("click", onClick, true);
      if (interceptionRevision === session) invalidateFeedback();
      return;
    }
    onDocumentClick(event);
  };
  document.addEventListener("click", onClick, { capture: true, passive: false });

  try {
    chrome.storage.local.get(["interceptFileLinks", "theme"], (items) => {
      setFileCaptureEnabled(
        typeof items?.interceptFileLinks === "boolean" ? items.interceptFileLinks : DEFAULTS.interceptFileLinks,
      );
      if (items?.theme && ["auto", "light", "dark"].includes(items.theme as string)) {
        currentTheme = items.theme as "auto" | "light" | "dark";
      }
    });

    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void => {
      if (areaName === "local") {
        if ("interceptFileLinks" in changes) {
          setFileCaptureEnabled(Boolean(changes.interceptFileLinks.newValue));
        }
        if ("theme" in changes && changes.theme.newValue) {
          currentTheme = changes.theme.newValue as "auto" | "light" | "dark";
        }
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      document.removeEventListener("click", onClick, true);
      try {
        chrome.storage.onChanged.removeListener(storageListener);
      } catch {
        // The prior extension context is invalid after a reload.
      }
      if (interceptionRevision === session) invalidateFeedback();
    };
  } catch {
    // Storage unreachable (torn-down extension context): magnets and Shift still work; only the
    // automatic ordinary-file preference cannot be learned.
    return () => {
      document.removeEventListener("click", onClick, true);
      if (interceptionRevision === session) invalidateFeedback();
    };
  }
}

function isCurrentFeedback(revision: number): boolean {
  return feedbackOwner === revision;
}

function clearFeedback(host: HTMLElement | null): void {
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
    toastTimeoutId = undefined;
  }
  feedbackRevision += 1;
  feedbackOwner += 1;
  host?.remove();
}

function invalidateFeedback(): void {
  for (const [url, pending] of pendingDispatches) releaseDispatch(url, pending);
  const host = document.getElementById("quickget-feedback-host");
  clearFeedback(host);
}

function snapshotFallback(event: MouseEvent, url: string): NativeFallback {
  const anchor = findAnchor(event);
  if (!(anchor instanceof HTMLAnchorElement)) return { url, target: "", download: null };

  return {
    url,
    target: anchor.target,
    download: anchor.hasAttribute("download") ? anchor.getAttribute("download") : null,
  };
}

function activateNativeFallback({ url, target, download }: NativeFallback): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = target;
  if (download !== null) anchor.setAttribute("download", download);
  anchor.click();
}

installMagnetInterception();
