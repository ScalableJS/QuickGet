/**
 * Download interception (Chrome only)
 *
 * Watches for .torrent downloads and routes them to QNAP Download Station. Torrent interception
 * is unconditional; ordinary-file interception remains the only user-controlled mode.
 *
 * Chromium can defer the filename decision while the NAS hand-off runs. The browser transfer is
 * cancelled only after Download Station accepts the torrent. Every earlier exit releases the
 * filename decision, so missing configuration, tracker failures and NAS failures all fall back
 * to the browser without a retry queue or persisted download-id state.
 */

import { performLogin } from "@api/index.js";
import type { Settings } from "@lib/config.js";
import { findConfigProblem } from "@lib/configHealth.js";
import { getErrorMessage } from "@lib/errors.js";
import { resolveDestination } from "@lib/routingRules.js";
import { loadSettings } from "@lib/settings.js";
import { isTorrentSource } from "@lib/sourceKind.js";
import { sendTorrentUrlToNas } from "@lib/torrentSender.js";

import { markConfigurationProblem, markSendNotice } from "./actions.js";
import { ensureMonitoring } from "./alarms.js";
import { clearFailureEpisode, type FailureKind, notifyFailure } from "./notifier.js";

export function initDownloadInterception(): void {
  if (!chrome.downloads?.onCreated) {
    console.warn("[QuickGet] downloads API unavailable — interception disabled");
    return;
  }

  chrome.downloads.onCreated.addListener((item) => {
    void handleDownloadCreated(item);
  });

  // Firefox has no onDeterminingFilename. The optional registration keeps its safe fallback
  // behavior, while Chromium can prevent a successful hand-off from leaving a local file.
  chrome.downloads.onDeterminingFilename?.addListener(handleDeterminingFilename);

  // Chrome often does not know the MIME type or the post-redirect URL when the download is
  // created — both are in `DownloadDelta`, so a tracker endpoint that only identifies itself
  // as a torrent later would never be intercepted from `onCreated` alone.
  chrome.downloads.onChanged?.addListener((delta) => {
    if (!delta.mime && !delta.finalUrl && !delta.filename) return;
    void handleDownloadChanged(delta.id);
  });

  console.log("[QuickGet] download interception listener registered");
}

/**
 * Hold Chromium at the last reversible point before it commits a file. Returning true tells the
 * browser that `suggest` will be called asynchronously. The callback is released on every handled
 * outcome. Chrome exposes no documented release deadline if the worker itself dies, so that crash
 * boundary is not simulated with persisted recovery state.
 */
export function handleDeterminingFilename(
  item: chrome.downloads.DownloadItem,
  suggest: (suggestion?: chrome.downloads.FilenameSuggestion) => void,
): boolean {
  const url = item.finalUrl || item.url;
  if (!/^https?:\/\//i.test(url) || !isTorrentSource(url, { mime: item.mime, filename: item.filename })) return false;

  heldFilenames.set(item.id, suggest);
  void handleDownloadCreated(item);
  return true;
}

/** Hand a `.torrent` to the NAS and stop the browser only after the NAS accepts it. */
export async function handleDownloadCreated(item: chrome.downloads.DownloadItem): Promise<void> {
  // Every exit is logged with its reason: without it a download that is simply not recognised
  // is indistinguishable from a worker that never received the event at all.
  let ownsInFlight = false;

  try {
    const url = item.finalUrl || item.url;
    if (!/^https?:\/\//i.test(url) || !isTorrentSource(url, { mime: item.mime, filename: item.filename })) {
      console.log("[QuickGet] skipped: not recognised as a torrent", {
        id: item.id,
        url,
        mime: item.mime,
        filename: item.filename,
      });
      return; // not a torrent — leave it to the browser
    }

    // onCreated and onChanged can recognise the same download concurrently. This guard exists
    // only for the lifetime of the current operation; NAS remains the only durable task state.
    if (!claimDownload(item.id)) {
      console.log("[QuickGet] skipped: already claimed by another listener", { id: item.id });
      return;
    }
    ownsInFlight = true;

    const settings = await loadSettings();
    // No usable NAS: the master password was never entered, storage.session was emptied by a
    // browser restart, or the connection was never configured. `isLocked()` only distinguishes
    // the first case for the message — it reports false in the second, so it cannot be the
    // guard itself. Leave the download alone; the browser will finish it normally.
    // Every setting a hand-off needs, checked before the download is touched. There is no
    // locked state to consider any more: a download starts when the user clicks a link, not
    // when they open the popup, so the password is always readable here or genuinely unset.
    const problem = findConfigProblem(settings);
    if (problem) {
      console.warn(`[QuickGet] not configured — leaving the download to the browser: ${problem.summary}`);

      await markConfigurationProblem(problem.summary);
      // The user clicked a link a moment ago, so this is worth interrupting for — but only
      // once per episode, not on every torrent they click while it stays unconfigured.
      await notifyFailure(
        "not-configured",
        "QuickGet not configured",
        `${problem.summary} The .torrent was left to the browser.`,
        problem.missing.join(","),
      );
      return;
    }

    // Configuration only says where the NAS should be; it does not prove the NAS is reachable
    // now. Verify the connection before touching the browser transfer or fetching the torrent.
    // This is deliberately a live request, never a persisted "Ready" flag: without a successful
    // login for this click, QuickGet has not intercepted anything and Chrome continues normally.
    try {
      await performLogin(settings);
    } catch (error) {
      const message = getErrorMessage(error);
      console.warn(`[QuickGet] NAS unavailable — leaving the download to the browser: ${message}`);
      await markConfigurationProblem(message);
      await notifyFailure(
        classifyConnectionFailure(error),
        "Could not reach NAS",
        `${message} The .torrent was left to the browser.`,
        settings.NASaddress,
      );
      return;
    }

    console.log("[QuickGet] intercepting torrent download", { id: item.id, url });

    // Chrome recorded the page the download started from — that is exactly the referrer a
    // tracker's hotlink guard expects, and the worker's own fetch would otherwise send none.
    // It also derived a filename from `Content-Disposition`, which for an opaque endpoint like
    // `dl.php?id=1` is the only name the routing rules would otherwise never see.
    const handedOff = await handOffToNas(
      settings,
      url,
      baseName(item.filename),
      item.referrer,
    );
    if (!handedOff) return;

    // The NAS owns the torrent now. A failed cancel is deliberately non-destructive: the browser
    // keeps its copy rather than pretending interception succeeded completely.
    if (await cancelBrowserDownload(item.id)) await eraseBrowserDownload(item.id);
  } catch (error) {
    console.error("[QuickGet] Download interception failed:", error);
    await notifyFailure("handoff", "Failed to redirect download", getErrorMessage(error));
  } finally {
    if (ownsInFlight) {
      releaseHeldFilename(item.id);
      inFlight.delete(item.id);
    }
  }
}

/**
 * Ids currently being processed. Added and tested *synchronously*, which is what settles the
 * race: `onCreated` and `onChanged` can both recognise the same download, and the
 * asynchronous work would otherwise let both send the torrent. Entries are released once
 * handling finishes; nothing survives the operation or service-worker lifetime.
 */
const inFlight = new Set<number>();
const heldFilenames = new Map<number, (suggestion?: chrome.downloads.FilenameSuggestion) => void>();

/** Take ownership of a download id, returning false if something else already has it. */
function claimDownload(id: number): boolean {
  if (inFlight.has(id)) return false;
  inFlight.add(id);
  return true;
}

/** Chrome reports a full target path; routing rules are written against the file name. */
function baseName(path?: string): string | undefined {
  const last = path?.split(/[/\\]/).pop()?.trim();
  return last || undefined;
}

/** Re-evaluate a download whose type-identifying fields only just became known. */
async function handleDownloadChanged(id: number): Promise<void> {
  try {
    const [item] = await chrome.downloads.search({ id });
    if (item && item.state === "in_progress") await handleDownloadCreated(item);
  } catch (error) {
    console.warn("[QuickGet] could not re-evaluate a changed download:", error);
  }
}

async function handOffToNas(
  settings: Settings,
  url: string,
  /** The name Chrome derived for the file, used for routing until the torrent itself is read. */
  suggestedName: string | undefined,
  referrer?: string,
): Promise<boolean> {
  try {
    // The kind is not in question here — this path only ever runs for a torrent — and the name
    // is resolved as late as possible: once the .torrent has been fetched its `info.name` is the
    // release itself, which is what a rule like `*.mkv` was written against.
    const route = (contentName?: string) =>
      resolveDestination(
        { url, kind: "torrent", name: contentName ?? suggestedName, pageUrl: referrer },
        settings.routingRules,
        settings.NASdir,
      );
    await sendTorrentUrlToNas(settings, url, route, referrer);
    void ensureMonitoring();
    await clearFailureEpisode();
    return true;
  } catch (error) {
    console.error("[QuickGet] Failed to send torrent:", error);
    // A failed hand-off is exactly the moment the toolbar should stop looking normal: the
    // download silently stayed in the browser, and nothing else on screen says so. But a
    // tracker login requirement is the user's action to take on the tracker's site, not an
    // extension/NAS fault — it must not be painted with the same red configuration badge.
    const failureKind = classifyFailure(error);
    if (failureKind === "auth") {
      await markSendNotice(getErrorMessage(error));
    } else {
      await markConfigurationProblem(getErrorMessage(error));
    }
    await notifyFailure(
      failureKind,
      "Download failed",
      `${getErrorMessage(error)} — the browser download continues locally.`,
      settings.NASaddress,
    );
    return false;
  }
}

function releaseHeldFilename(id: number): void {
  const suggest = heldFilenames.get(id);
  if (!suggest) return;
  heldFilenames.delete(id);
  try {
    suggest();
  } catch (error) {
    console.warn("[QuickGet] could not release a deferred filename:", error);
  }
}

async function cancelBrowserDownload(id: number): Promise<boolean> {
  try {
    await chrome.downloads.cancel(id);
    return true;
  } catch (error) {
    console.warn("[QuickGet] NAS accepted the torrent, but the browser download could not be cancelled:", error);
    return false;
  }
}

async function eraseBrowserDownload(id: number): Promise<void> {
  try {
    await chrome.downloads.erase({ id });
  } catch (error) {
    console.warn("[QuickGet] could not remove the cancelled torrent from browser history:", error);
  }
}

/** Distinguishes failures so an episode of one kind does not silence a different problem. */
function classifyFailure(error: unknown): FailureKind {
  const message = getErrorMessage(error).toLowerCase();
  if (message.includes("username or password") || message.includes("refused the download")) {
    return "auth";
  }
  if (message.includes("failed to fetch") || message.includes("networkerror")) return "unreachable";
  return "handoff";
}

/** Classify a failed preflight without confusing NAS authentication with tracker authentication. */
function classifyConnectionFailure(error: unknown): FailureKind {
  const message = getErrorMessage(error).toLowerCase();
  if (message.includes("username or password") || message.includes("login failed")) return "not-configured";
  return "unreachable";
}
