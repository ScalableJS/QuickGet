/**
 * When to raise a system notification, and when to stay quiet.
 *
 * A toast is not a log. It is worth the interruption only when the user must learn something
 * *now*, while the popup is closed — which it almost always is when a torrent is intercepted.
 * Previously every outcome raised one, so the messages that mattered were buried among
 * confirmations of things that had simply worked.
 *
 * Two rules follow:
 *
 * 1. **Success is silent.** Plumbing should be invisible when it works. A sent torrent and a
 *    torrent already on the NAS both leave the user with nothing to do, so neither interrupts.
 *    The task list remains the source of truth.
 * 2. **Failures are reported once per episode**, not once per attempt. Clicking five links at
 *    an unreachable NAS is one problem, not five, and five identical toasts train the user to
 *    dismiss them without reading.
 *
 * The episode state lives in `chrome.storage.session` because a module global does not survive
 * the worker being torn down — which happens roughly every 30 seconds of inactivity, i.e.
 * routinely between two downloads.
 */

const EPISODE_KEY = "qg:notificationEpisode";

/** How long an unchanged, unresolved failure stays quiet before speaking up again. */
const REPEAT_AFTER_MS = 30 * 60 * 1000;

export type FailureKind = "not-configured" | "auth" | "unreachable" | "handoff" | "recovery-needed";

type Episode = {
  kind: FailureKind;
  /** Distinguishes two different problems of the same kind, e.g. a different NAS host. */
  fingerprint: string;
  shownAt: number;
};

/**
 * Report a failure, at most once per episode.
 *
 * A toast is raised when the problem is new: a different kind, a different subject, the first
 * failure after things were working, or the same problem still unresolved after 30 minutes.
 */
export async function notifyFailure(
  kind: FailureKind,
  title: string,
  message: string,
  fingerprint = "",
): Promise<void> {
  const stored = await chrome.storage.session.get(EPISODE_KEY);
  const previous = stored[EPISODE_KEY] as Episode | undefined;

  const now = Date.now();
  const sameProblem = previous?.kind === kind && previous.fingerprint === fingerprint;
  if (sameProblem && now - previous.shownAt < REPEAT_AFTER_MS) {
    // Same unresolved problem, recently announced. The badge is still showing it.
    return;
  }

  await chrome.storage.session.set({ [EPISODE_KEY]: { kind, fingerprint, shownAt: now } satisfies Episode });
  createNotification(title, message);
}

/**
 * Note that things are working again, so the next failure speaks up immediately rather than
 * being suppressed as a repeat. Deliberately silent: "Connection restored" is an interruption
 * that asks nothing of the user.
 */
export async function clearFailureEpisode(): Promise<void> {
  await chrome.storage.session.remove(EPISODE_KEY);
}

/**
 * A notification the user's own action asked for, shown regardless of episode state — they
 * clicked something a moment ago and are waiting to hear what happened.
 */
export function notifyDirect(title: string, message: string): void {
  createNotification(title, message);
}

function createNotification(title: string, message: string): void {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/128_download.png"),
      title,
      message,
    });
  } catch (error) {
    console.log("Notifications not available:", error);
  }
}
