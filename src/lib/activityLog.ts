/**
 * A short record of what the extension did while the popup was closed.
 *
 * Once successful sends stop raising a notification, this is the only place they are visible.
 * It is not a delivery channel — nobody watches it — but it answers "did that actually go
 * through?" without the user having to open Download Station.
 *
 * Deliberately *not* stored: the source URL. Tracker download links are commonly signed and
 * carry a session token in the query string; keeping them would turn a convenience log into a
 * credential store. The file name, the host and the outcome are enough to recognise an entry.
 */

const KEY = "qg:activity";
const LIMIT = 50;

export type ActivityOutcome = "sent" | "duplicate" | "failed" | "left-to-browser";

export type ActivityEntry = {
  at: number;
  name: string;
  /** Host only — never the full URL. */
  source: string;
  outcome: ActivityOutcome;
  /** Short reason, present for the outcomes that need explaining. */
  detail?: string;
};

export async function recordActivity(entry: Omit<ActivityEntry, "at">): Promise<void> {
  try {
    const entries = await readActivity();
    entries.unshift({ ...entry, at: Date.now() });
    await chrome.storage.local.set({ [KEY]: entries.slice(0, LIMIT) });
  } catch (error) {
    // A log that cannot be written must never break the thing it is logging.
    console.warn("[QuickGet] could not record activity:", error);
  }
}

export async function readActivity(): Promise<ActivityEntry[]> {
  const stored = await chrome.storage.local.get(KEY);
  const entries = stored[KEY];
  return Array.isArray(entries) ? (entries as ActivityEntry[]) : [];
}

export async function clearActivity(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}

/** Host of a URL, for display. Returns "" rather than throwing on anything unparseable. */
export function sourceHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
