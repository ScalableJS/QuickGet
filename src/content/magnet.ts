/**
 * Content script: sends magnet clicks to QNAP Download Station.
 * Injected at document_start into all frames.
 *
 * Adheres to strict DOM Event Loop semantics:
 * - Ordinary enabled magnet clicks retain their browser protocol-handler fallback.
 * - Shift-click cancels link navigation synchronously before any async work.
 * - Forward magnet URI to the Service Worker via runtime.sendMessage.
 * - Provide immediate feedback in an isolated Shadow DOM toast.
 * - On failure, offer explicit [Retry] and [Open locally] buttons (compensating fallback).
 */

import { DEFAULTS } from "@lib/config.js";
import { isDownloadableFileUrl, isTorrentSource } from "@lib/sourceKind.js";

export type MagnetMessage = {
  type: "task:add";
  uri: string;
  source: "magnet-click";
  pageUrl: string;
};

/**
 * "Send this one, whatever the settings say."
 *
 * Shift is the per-click opt-in: the checkboxes decide whether links are taken automatically,
 * Shift takes the one under the cursor regardless. It means the default matters less — someone
 * who does not want automatic interception can turn it off and still use the extension with a
 * modifier, without a trip to Settings or the context menu for every link.
 *
 * A `.torrent` needs its own message because a magnet click can be cancelled in the page while a
 * `.torrent` would otherwise become a browser download the worker meets with no memory of the
 * modifier — `DownloadItem` carries no modifier state.
 */
export type SendLinkMessage = {
  type: "link:send";
  url: string;
  pageUrl: string;
};

export type MagnetResponse = { ok: true; deduped?: boolean } | { ok: false; error: string; code?: string };

const inFlightUris = new Set<string>();
const CONTENT_SCRIPT_CLEANUP_KEY = "quickget:magnet-content-cleanup";

/**
 * Determine whether a mouse event represents an eligible, trusted primary click on a link.
 *
 * Shift is allowed through on purpose — it is the "send this one" gesture, and the same rule has
 * to hold for magnets and for `.torrent` links or one modifier would mean opposite things on two
 * kinds of link. Ctrl, Cmd and Alt keep their native meanings (new tab, new window, download the
 * link); we take Shift and nothing else.
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
 * The absolute URL of a Shift-clicked `.torrent` link, or `null` for every other click.
 *
 * Recognition happens from the href alone, so `.torrent` endings and TorrentPier's `/dl.php` are
 * caught but an opaque endpoint that reveals itself only through a response MIME type is not —
 * from inside the page it is indistinguishable from any other link, and preventing every
 * Shift-click on the web to find out is not a trade worth making.
 */
export function getShiftSendUrl(event: MouseEvent): string | null {
  if (!event.isTrusted || event.button !== 0 || !event.cancelable) return null;
  if (event.defaultPrevented) return null;
  if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return null;

  const anchor = findAnchor(event);
  const href = anchor instanceof HTMLAnchorElement ? anchor.href : null;
  if (!href || !/^https?:/i.test(href)) return null;

  return isTorrentSource(href) ? href : null;
}

/**
 * The absolute URL of a plainly-clicked link to an ordinary file, or `null` (RES-5).
 *
 * Two signals, both readable synchronously, because `preventDefault()` cannot wait for a network
 * round trip: the anchor's own `download` attribute — the page saying outright that this is a
 * file — or a known extension in the URL's path. Nothing here inspects a response; a link that
 * only reveals itself as a file through its `Content-Type` is left to the browser.
 *
 * Shift is not consulted. That gesture already means "send this one whatever the settings say"
 * and is handled above; this is the automatic path and answers only to its own checkbox.
 */
export function getFileSendUrl(event: MouseEvent): string | null {
  if (!isEligibleClick(event)) return null;
  if (event.shiftKey) return null;

  const anchor = findAnchor(event);
  if (!(anchor instanceof HTMLAnchorElement)) return null;

  const href = anchor.href;
  if (!href || !/^https?:/i.test(href)) return null;
  // A torrent has its own path, which mirrors and keeps the local copy. Claiming it here would
  // quietly change that to NAS-only the moment this checkbox is ticked.
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
      <span class="msg">${message}</span>
      ${actions.map((action, index) => `<button id="qg-action-${index}" class="btn-action" type="button">${action.label}</button>`).join("")}
      <button id="qg-dismiss" class="btn-dismiss" type="button" title="Close" aria-label="Close">✕</button>
    </div>
  `;

  const dismissBtn = shadow.getElementById("qg-dismiss");
  dismissBtn?.addEventListener("click", () => {
    host?.remove();
  });
  for (const [index, action] of actions.entries()) {
    shadow.getElementById(`qg-action-${index}`)?.addEventListener("click", action.onClick);
  }

  if (state === "success") {
    toastTimeoutId = setTimeout(() => {
      host?.remove();
    }, 2500);
  } else if (state === "error" && actions.length === 0) {
    toastTimeoutId = setTimeout(() => {
      host?.remove();
    }, 4000);
  }
}

/**
 * Forward an eligible magnet URI to the Service Worker. An ordinary click deliberately keeps
 * the browser's magnet protocol flow: there is no cross-browser API for discovering or invoking
 * a local magnet handler ourselves. Shift is the explicit full-interception gesture and claims
 * the click before dispatching it.
 */
function sendMagnetToWorker(uri: string): void {
  if (inFlightUris.has(uri)) return;
  inFlightUris.add(uri);

  showFeedback("loading", "Sending to Download Station…");

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
          showFeedback("success", "Sent to Download Station");
        } else {
          const err = response?.error || "NAS rejected the link";
          showFeedback("error", `Failed to send: ${err}`);
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
 * Whether plain clicks on magnets are taken automatically. Shift-clicks do not consult it — that
 * gesture is the per-click opt-in and works whatever the checkbox says.
 */
let magnetCaptureEnabled = DEFAULTS.interceptTorrentLinks;

export function setMagnetCaptureEnabled(enabled: boolean): void {
  magnetCaptureEnabled = enabled;
}

/** Whether a plain click on an ordinary file link is sent to the NAS (RES-5). Off by default. */
let fileCaptureEnabled = DEFAULTS.interceptFileLinks;

export function setFileCaptureEnabled(enabled: boolean): void {
  fileCaptureEnabled = enabled;
}

/**
 * The interception switch as stored, falling back to the three keys that preceded it. The worker
 * migrates storage on its own schedule, and a content script can load into a page before that has
 * happened; reading the old key here keeps the first page after an update behaving correctly.
 */
function readInterception(items: Record<string, unknown> | undefined): boolean {
  if (typeof items?.interceptTorrentLinks === "boolean") return items.interceptTorrentLinks;
  if (items?.torrentInterceptMode === "off") return false;
  return DEFAULTS.interceptTorrentLinks;
}

/**
 * Hand a Shift-clicked link to the worker, which sends it the same way the context menu does —
 * fetching a `.torrent` in the page's own session when the tracker needs one.
 */
function sendLinkToWorker(url: string): void {
  if (inFlightUris.has(url)) return;
  inFlightUris.add(url);

  showFeedback("loading", "Sending to Download Station…");

  const message: SendLinkMessage = { type: "link:send", url, pageUrl: window.location.href };
  try {
    chrome.runtime.sendMessage(message, (response: MagnetResponse | undefined) => {
      inFlightUris.delete(url);
      const lastErr = chrome.runtime.lastError;
      if (lastErr) {
        showLinkFailure(url, `Could not contact QuickGet: ${lastErr.message}`);
        return;
      }
      if (response?.ok) {
        showFeedback("success", "Sent to Download Station");
        return;
      }
      showLinkFailure(url, response?.error ?? "Could not send to Download Station");
    });
  } catch (error) {
    inFlightUris.delete(url);
    showLinkFailure(url, error instanceof Error ? error.message : "Could not contact QuickGet");
  }
}

function showLinkFailure(url: string, message: string): void {
  showFeedback("error", message, [
    { label: "Retry", onClick: () => sendLinkToWorker(url) },
    { label: "Open locally", onClick: () => window.location.assign(url) },
  ]);
}

/**
 * Click handler registered on document during the capture phase.
 *
 * Always attached, because Shift has to work even when both automatic modes are off — that is
 * the whole point of it. Nothing happens on an ordinary click in that configuration.
 */
function onDocumentClick(event: MouseEvent): void {
  const shiftSendUrl = getShiftSendUrl(event);
  if (shiftSendUrl) {
    // Shift's native meaning is "open in a new window", which for a `.torrent` would flash a
    // window and start a download we then have to chase. Cancelling and handing the worker the
    // URL keeps it on the same path the context menu uses.
    claimLinkClick(event);
    sendLinkToWorker(shiftSendUrl);
    return;
  }

  const uri = getMagnetUri(event);
  if (uri) {
    if (!event.shiftKey && !magnetCaptureEnabled) return;
    if (event.shiftKey) claimLinkClick(event);
    sendMagnetToWorker(uri);
    return;
  }

  // Last, so a magnet or a torrent is never reached by the file rule.
  if (!fileCaptureEnabled) return;
  const fileUrl = getFileSendUrl(event);
  if (!fileUrl) return;

  claimLinkClick(event);
  sendLinkToWorker(fileUrl);
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
 * Initialize listener based on storage configuration.
 */
export function initMagnetInterception(): () => void {
  // Attached unconditionally. The setting decides what an *ordinary* click does; the listener has
  // to exist either way, or Shift — the gesture whose entire purpose is working when automatic
  // capture is off — would be dead in exactly the configuration it exists for.
  document.addEventListener("click", onDocumentClick, { capture: true, passive: false });

  try {
    chrome.storage.local.get(["interceptTorrentLinks", "interceptFileLinks", "torrentInterceptMode", "theme"], (items) => {
      setMagnetCaptureEnabled(readInterception(items));
      setFileCaptureEnabled(
        typeof items?.interceptFileLinks === "boolean" ? items.interceptFileLinks : DEFAULTS.interceptFileLinks,
      );
      if (items?.theme && ["auto", "light", "dark"].includes(items.theme as string)) {
        currentTheme = items.theme as "auto" | "light" | "dark";
      }
    });

    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void => {
      if (areaName === "local") {
        if ("interceptTorrentLinks" in changes) {
          setMagnetCaptureEnabled(Boolean(changes.interceptTorrentLinks.newValue));
        }
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
      chrome.storage.onChanged.removeListener(storageListener);
      document.removeEventListener("click", onDocumentClick, true);
    };
  } catch {
    // Storage unreachable (torn-down extension context): the Shift gesture still works, it just
    // cannot learn whether automatic capture is on.
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
    };
  }
}

// Auto-run in browser context
if (typeof window !== "undefined" && typeof chrome !== "undefined" && chrome.runtime?.id) {
  const existingCleanup = Reflect.get(globalThis, CONTENT_SCRIPT_CLEANUP_KEY);
  if (typeof existingCleanup === "function") existingCleanup();
  Reflect.set(globalThis, CONTENT_SCRIPT_CLEANUP_KEY, initMagnetInterception());
}
