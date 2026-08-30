/**
 * Download interception (Chrome only)
 *
 * Watches for .torrent downloads and routes them to QNAP Download Station.
 * Behaviour is driven by settings.torrentInterceptMode:
 *   - "off"    → do nothing (normal browser download)
 *   - "always" → hand the torrent to the NAS, cancelling the browser download only once
 *                the NAS has accepted it
 *
 * `settings.suppressLocalTorrentFile` then chooses *when* the browser copy dies:
 *   - false (default) → transactional. Pause, hand off, cancel on success / resume on
 *     failure. A failed hand-off costs nothing: the browser just finishes the download.
 *   - true (Chrome only) → cancel at the `onDeterminingFilename` stage, before Chrome can
 *     prompt "Save as" or commit a file. Not transactional — a failed hand-off means the
 *     user re-clicks — but nothing is left in Downloads.
 */

import type { Settings } from "@lib/config.js";
import { findConfigProblem } from "@lib/configHealth.js";
import { recordFailure, recordSuccess } from "@lib/connectionHealth.js";
import { getErrorMessage } from "@lib/errors.js";
import { classifyUrl, resolveDestination } from "@lib/routingRules.js";
import { loadSettings } from "@lib/settings.js";
import {
  findExistingTask,
  isRestartable,
  isTorrentSource,
  resumeTask,
  sendTorrentUrlToNas,
} from "@lib/torrentSender.js";

import { markConfigurationProblem, markInterceptionStarted, markSendNotice } from "./actions.js";
import { ensureMonitoring } from "./alarms.js";
import { clearFailureEpisode, type FailureKind, notifyDirect, notifyFailure } from "./notifier.js";

const RESUME_PREFIX = "qg-resume-";
/** Marks a download paused for a hand-off that has not reached its terminal action yet. */
const PENDING_PREFIX = "qg-pending-";
/** Marks a download already taken over, so onCreated and onChanged cannot both send it. */
const CLAIMED_PREFIX = "qg-claimed-";

const pendingKey = (id: number): string => `${PENDING_PREFIX}${id}`;

/**
 * Filename decisions briefly deferred, keyed by download id.
 *
 * The window this holds open is **short by design**. Chromium's filename determiner has its
 * own timeout — 15 seconds in current source — after which it stops waiting and finishes the
 * download into the default folder regardless (crbug 40359474 describes exactly that: the
 * file lands after 15s with the Save As dialog still open). So the hold must never span the
 * NAS round-trip; it spans only the local decision "is this ours", after which the download is
 * cancelled and `suggest()` is called immediately.
 *
 * In memory only, and deliberately so: a `suggest` callback cannot be persisted, and if MV3
 * suspends the worker Chrome continues on its own. `releaseHeldFilename()` must run on every
 * terminal path, or the download stalls until that timeout fires.
 */
const heldFilenames = new Map<number, (suggestion?: chrome.downloads.FilenameSuggestion) => void>();

/**
 * Ids reserved by `onCreated` purely so `onDeterminingFilename` knows to hold them.
 *
 * Separate from `inFlight`, which means "a hand-off owns this". The reservation is taken
 * synchronously on a *possible* torrent, before settings can say whether we want it at all;
 * `inFlight` is only taken once that is known. Holding first and deciding after is the only
 * order that works, because the filename event does not wait for us to make up our mind.
 */
const reservedForHold = new Set<number>();

/**
 * Decide, without awaiting anything, whether this download might be one we take over.
 * Deliberately permissive: over-reserving costs a released hold, under-reserving costs the
 * whole feature. Settings are not readable here, so `suppressLocalTorrentFile` is checked
 * later — a reservation alone never changes what the browser does.
 */
function reserveForFilenameHold(item: chrome.downloads.DownloadItem): boolean {
  if (!chrome.downloads.onDeterminingFilename) return false;
  const url = item.finalUrl || item.url;
  if (!/^https?:\/\//i.test(url)) return false;
  if (!isTorrentSource(url, item.mime, item.filename)) return false;
  reservedForHold.add(item.id);
  return true;
}

/** Drop the reservation and let go of any hold it was covering. */
function releaseReservation(id: number): void {
  reservedForHold.delete(id);
  releaseHeldFilename(id);
}

/**
 * Hold a download at the filename stage so `handleDownloadCreated()` can decide its fate
 * before Chrome commits a file or prompts "Save as".
 *
 * Exported for tests: the event never fires under Playwright's persistent context (the
 * automation harness assigns download paths itself), so this is the only way the strict path
 * can be exercised at all.
 */
export function handleDeterminingFilename(
  item: chrome.downloads.DownloadItem,
  suggest: (suggestion?: chrome.downloads.FilenameSuggestion) => void,
): boolean {
  // Only hold what a hand-off may claim. Every other download in the browser — and every
  // torrent when the user has not asked for this — must pass straight through untouched.
  if (!reservedForHold.has(item.id)) return false;
  heldFilenames.set(item.id, suggest);
  return true; // `suggest` runs later, or deliberately never once the NAS has the torrent
}

/** Reserve an id for holding. Exported for tests; production takes this from `onCreated`. */
export function reserveDownloadForHold(item: chrome.downloads.DownloadItem): boolean {
  return reserveForFilenameHold(item);
}

/** Let a deferred download proceed to disk. Safe to call when nothing is held. */
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

export function initDownloadInterception(): void {
  if (!chrome.downloads?.onCreated) {
    console.warn("[QuickGet] downloads API unavailable — interception disabled");
    return;
  }

  chrome.downloads.onCreated.addListener((item) => {
    // Reserve the id *synchronously*, before the first await in `handleDownloadCreated()`.
    // `onDeterminingFilename` can fire while settings are still loading, and it must find the
    // id already reserved or the download slips through un-held. A reservation that turns out
    // not to be a torrent is released again below.
    const reserved = reserveForFilenameHold(item);
    void handleDownloadCreated(item).finally(() => {
      if (reserved) releaseReservation(item.id);
    });
  });

  // Chrome-only (Firefox has never implemented it — Bugzilla 1245652). Without this listener
  // a `.torrent` is already committed by the time `onCreated` arrives, so a fast one finishes
  // before the cancel and Chrome may have shown "Save as" on the way.
  chrome.downloads.onDeterminingFilename?.addListener(handleDeterminingFilename);

  // Chrome often does not know the MIME type or the post-redirect URL when the download is
  // created — both are in `DownloadDelta`, so a tracker endpoint that only identifies itself
  // as a torrent later would never be intercepted from `onCreated` alone.
  chrome.downloads.onChanged?.addListener((delta) => {
    if (!delta.mime && !delta.finalUrl && !delta.filename) return;
    void handleDownloadChanged(delta.id);
  });

  chrome.notifications.onButtonClicked.addListener((notificationId) => {
    void handleNotificationButton(notificationId);
  });

  // The worker may have been killed mid-hand-off, leaving a download paused forever.
  // This runs on every worker start, which is exactly when such a leftover can be found.
  void recoverAbandonedHandoffs();

  console.log("[QuickGet] download interception listener registered");
}

/**
 * MV3 terminates the service worker on its own schedule — a slow or unreachable NAS can
 * outlive it, in which case neither the cancel nor the resume ever runs and the browser
 * download stays paused with nothing left to release it.
 *
 * The pending marker lives in `chrome.storage.session`, which survives worker restarts but
 * not a browser restart; a download interrupted by a browser restart is unresumable anyway.
 */
export async function recoverAbandonedHandoffs(): Promise<void> {
  try {
    const stored = await chrome.storage.session.get(null);
    const abandoned = Object.keys(stored).filter((key) => key.startsWith(PENDING_PREFIX));

    // Every claim is held by a worker that no longer exists — the in-memory half of the guard
    // died with it. Left in place they would bar the download from ever being retried, and
    // accumulate one entry per download for the life of the browser session.
    const staleClaims = Object.keys(stored).filter((key) => key.startsWith(CLAIMED_PREFIX));

    if (abandoned.length === 0 && staleClaims.length === 0) return;

    if (abandoned.length > 0) {
      console.warn(`[QuickGet] recovering ${abandoned.length} abandoned hand-off(s)`);
      for (const key of abandoned) {
        const id = Number(key.slice(PENDING_PREFIX.length));
        if (Number.isFinite(id)) await resumeBrowserDownload(id);
      }
    }

    await chrome.storage.session.remove([...abandoned, ...staleClaims]);
  } catch (error) {
    console.error("[QuickGet] could not recover abandoned hand-offs:", error);
  }
}

/**
 * Hand a `.torrent` download over to the NAS without ever destroying it on failure.
 *
 * The transfer is transactional: pause the browser download, try the hand-off, and only
 * cancel once the NAS has accepted it — otherwise resume and let the browser finish.
 * Cancelling first (as this did until the "ask" mode was removed) loses the file whenever
 * the NAS is unreachable, the credentials are missing, or the URL is single-use.
 */
export async function handleDownloadCreated(item: chrome.downloads.DownloadItem): Promise<void> {
  // Every exit is logged with its reason: without it a download that is simply not recognised
  // is indistinguishable from a worker that never received the event at all.
  let ownsInFlight = false;

  try {
    const settings = await loadSettings();
    if (settings.torrentInterceptMode === "off") {
      console.log("[QuickGet] skipped: interception is off in Settings", { id: item.id });
      return;
    }

    const url = item.finalUrl || item.url;
    if (!/^https?:\/\//i.test(url) || !isTorrentSource(url, item.mime, item.filename)) {
      console.log("[QuickGet] skipped: not recognised as a torrent", {
        id: item.id,
        url,
        mime: item.mime,
        filename: item.filename,
      });
      return; // not a torrent — leave it to the browser
    }

    // onCreated and onChanged can both recognise the same download; whichever gets here
    // first owns it, and the session marker keeps that true across a worker restart.
    if (!(await claimDownload(item.id))) {
      console.log("[QuickGet] skipped: already claimed by another listener", { id: item.id });
      return;
    }
    ownsInFlight = true;

    console.log("[QuickGet] intercepting torrent download", { id: item.id, url });

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
        "QuickGet is not configured",
        `${problem.summary} The .torrent was left to the browser.`,
        problem.missing.join(","),
      );
      return;
    }

    // Strict mode: drop the browser transfer at the first moment we know it is ours — before
    // any toolbar work, and while `onDeterminingFilename` is still holding the file back. Any
    // later and a small `.torrent` from a fast host has already landed. The hand-off re-fetches
    // the URL itself, so cancelling first costs a re-download on failure, not the file.
    const strict = settings.suppressLocalTorrentFile && heldFilenames.has(item.id);
    if (strict) {
      await cancelBrowserDownload(item.id);
      releaseHeldFilename(item.id);
    }

    // Chrome recorded the page the download started from — that is exactly the referrer a
    // tracker's hotlink guard expects, and the worker's own fetch would otherwise send none.
    await markInterceptionStarted();
    await handOffToNas(settings, item.id, url, item.referrer, strict);
  } catch (error) {
    console.error("[QuickGet] Download interception failed:", error);
    // The claim outlives this worker, so keeping it after a failure would silently bar every
    // later attempt at the same download — including the `onChanged` event that carries the
    // MIME type. Release it so the retry path stays open.
    await releaseClaim(item.id);
    await notifyFailure("handoff", "Failed to redirect download", getErrorMessage(error));
  } finally {
    if (ownsInFlight) inFlight.delete(item.id);
  }
}

/**
 * Ids currently being processed. Added and tested *synchronously*, which is what settles the
 * race: `onCreated` and `onChanged` can both recognise the same download, and the
 * `await chrome.storage.session.get()` below would otherwise let both read "unclaimed" and
 * send the torrent twice. Entries are released once handling finishes, so this guards
 * concurrency only — the durable "already handled" record is the session marker.
 */
const inFlight = new Set<number>();

/** Take ownership of a download id, returning false if something else already has it. */
async function claimDownload(id: number): Promise<boolean> {
  if (inFlight.has(id)) return false;
  inFlight.add(id);
  let claimed = false;

  try {
    const key = `${CLAIMED_PREFIX}${id}`;
    const existing = await chrome.storage.session.get(key);
    if (existing[key]) return false;

    await chrome.storage.session.set({ [key]: true });
    claimed = true;
    return true;
  } finally {
    // A caller which learned that a durable claim already exists (or could not persist its
    // own) still owns this in-memory entry and must release only that entry.
    if (!claimed) inFlight.delete(id);
  }
}

async function releaseClaim(id: number): Promise<void> {
  await chrome.storage.session.remove(`${CLAIMED_PREFIX}${id}`).catch(() => {});
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

async function handleNotificationButton(notificationId: string): Promise<void> {
  if (notificationId.startsWith(RESUME_PREFIX)) {
    await handleResumeButton(notificationId);
  }
}

async function handOffToNas(
  settings: Settings,
  downloadId: number,
  url: string,
  referrer?: string,
  /** The browser download was already cancelled at the filename stage — nothing to pause. */
  strict = false,
): Promise<void> {
  // Write intent before touching the browser transfer: if MV3 suspends us in the following
  // await, startup recovery can resume it. A pause which does not happen must not leave a
  // false recovery record behind.
  // Permissive (default) still lets the browser hold the file as a safety net, so release any
  // filename hold before pausing. Strict already cancelled it upstream.
  if (!strict) releaseHeldFilename(downloadId);

  await chrome.storage.session.set({ [pendingKey(downloadId)]: true });
  const paused = strict ? false : await pauseBrowserDownload(downloadId);
  if (!paused) await chrome.storage.session.remove(pendingKey(downloadId));

  try {
    const folder = resolveDestination({ url, kind: classifyUrl(url) }, settings.routingRules, settings.NASdir);
    const { name, duplicate } = await sendTorrentUrlToNas(settings, url, folder, referrer);

    // The NAS owns the torrent now — only here is it safe to drop the browser's copy. If the
    // cancel itself fails we must not leave the transfer paused: put it back to the browser.
    // In strict mode the download was already cancelled at the filename stage, so there is
    // nothing left to cancel and nothing that could have been paused.
    if (!strict) {
      const cancelled = await cancelBrowserDownload(downloadId);
      if (!cancelled && paused) await resumeBrowserDownload(downloadId);
    }
    void ensureMonitoring();

    // Success is silent: the task list is the source of truth and nothing is asked of the user.
    await clearFailureEpisode();
    await recordSuccess();

    if (duplicate) await offerResumeIfStalled(settings, name);
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
    await recordFailure(error);
    // The hand-off is over and it failed. The claim must not outlive it: the browser is
    // finishing the download itself now, and a later `onChanged` for the same id (or the user
    // retrying) has to be able to take it again.
    await releaseClaim(downloadId);
    // The browser is keeping this download, so it needs its filename back before anything
    // else — a resume against a still-deferred download would never produce a file.
    releaseHeldFilename(downloadId);
    const resumed = paused ? await resumeBrowserDownload(downloadId) : false;
    await notifyFailure(
      failureKind,
      "QuickGet needs attention",
      // Strict mode already dropped the browser download to keep it off disk, so there is
      // nothing to resume — say that plainly instead of implying the file is still coming.
      `${getErrorMessage(error)}${
        strict ? " — the browser download was cancelled; click the link again to retry." : rollbackSuffix(paused, resumed)
      }`,
      settings.NASaddress,
    );
  } finally {
    // Last resort. Every path above already released or deliberately discarded the hold, but
    // an unforeseen throw between them would otherwise strand the download at the filename
    // stage with nothing left to free it — invisible to the user and unrecoverable.
    releaseHeldFilename(downloadId);
    // A terminal action ran, so there is nothing left for the recovery sweep to release.
    if (paused) await chrome.storage.session.remove(pendingKey(downloadId));
  }
}

/** Say what actually happened to the browser download — never claim a resume that failed. */
function rollbackSuffix(paused: boolean, resumed: boolean): string {
  if (!paused) return "";
  return resumed
    ? " — browser download resumed."
    : " — the browser download is paused; resume it from the downloads list.";
}

/**
 * A duplicate is normally silent — the desired end state already exists. The exception is a
 * task that is on the NAS but stalled: that one *is* worth interrupting for, because clicking
 * the link again will keep doing nothing until someone restarts it.
 */
async function offerResumeIfStalled(settings: Settings, name: string): Promise<void> {
  const existing = await findExistingTask(settings, name).catch((error) => {
    console.warn("[QuickGet] could not look up existing task:", error);
    return undefined;
  });

  if (!existing?.hash || !isRestartable(existing.status)) return;

  chrome.notifications.create(`${RESUME_PREFIX}${existing.hash}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/128_download.png"),
    title: `Already on NAS — ${existing.status}`,
    message: name,
    buttons: [{ title: "Resume" }],
    requireInteraction: true,
  });
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

async function handleResumeButton(notificationId: string): Promise<void> {
  chrome.notifications.clear(notificationId);
  const hash = notificationId.slice(RESUME_PREFIX.length);
  if (!hash) return;

  try {
    const settings = await loadSettings();
    await resumeTask(settings, hash);
    notifyDirect("Resumed on NAS", "Task restarted");
  } catch (error) {
    console.error("[QuickGet] Failed to resume task:", error);
    notifyDirect("Failed to resume task", getErrorMessage(error));
  }
}

/**
 * Hold the transfer while the NAS hand-off is attempted. Returns whether the download was
 * actually paused — a `.torrent` is small enough that it may already have finished, and a
 * download that was never paused must not be resumed.
 */
async function pauseBrowserDownload(id: number): Promise<boolean> {
  try {
    await chrome.downloads.pause(id);
    return true;
  } catch {
    // Not active any more, or the pause failed for another reason. Either way we must not
    // assume it can be resumed later.
    return false;
  }
}

async function resumeBrowserDownload(id: number): Promise<boolean> {
  try {
    await chrome.downloads.resume(id);
    return true;
  } catch (error) {
    console.warn("[QuickGet] could not resume the browser download:", error);
    return false;
  }
}

/**
 * Intentionally does NOT erase the item: a cancelled download stays in the browser's download
 * list with a "Retry" affordance, so the user can still fetch the original `.torrent` normally
 * if the notification is dismissed. Erasing it would make the download unrecoverable.
 */
async function cancelBrowserDownload(id: number): Promise<boolean> {
  try {
    await chrome.downloads.cancel(id);
    return true;
  } catch {
    return false; // already finished or not cancellable
  }
}
