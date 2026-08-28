/**
 * Optional password on the settings screen.
 *
 * This is a lock on the UI, not encryption. The service worker must be able to reach the NAS
 * whenever a download starts — the user is not there to type anything — so the NAS password
 * cannot be encrypted with a key only the user knows. Pretending otherwise is what the previous
 * design did, and it cost every intercepted torrent after a browser restart: the extension sat
 * "locked" while the user, who never opened the popup, saw downloads silently stay in Chrome.
 *
 * So the scope is deliberately small and honest: it stops someone at the same computer from
 * reading or changing the NAS connection. It does not protect the stored password from anyone
 * who can read the browser profile — that is the operating system's job, via disk encryption
 * and account separation, not this extension's.
 *
 * The password itself is never stored. Only a salt and a PBKDF2 verifier are kept, and the
 * unlocked flag lives in `chrome.storage.session`, so it clears when the browser restarts while
 * downloads keep working throughout.
 */

import { createLogger } from "./logger.js";

const logger = createLogger("SettingsLock", { enabled: true });

const ENABLED_KEY = "settingsLockEnabled";
const SALT_KEY = "settingsLockSalt";
const VERIFIER_KEY = "settingsLockVerifier";
const UNLOCKED_KEY = "settingsUnlocked";

/** Matches the cost used for the previous credential encryption. */
const ITERATIONS = 250_000;

export type SettingsLockState = {
  enabled: boolean;
  unlocked: boolean;
};

export async function getSettingsLockState(): Promise<SettingsLockState> {
  const local = await chrome.storage.local.get([ENABLED_KEY, VERIFIER_KEY]);
  const enabled = Boolean(local[ENABLED_KEY]) && typeof local[VERIFIER_KEY] === "string";
  if (!enabled) return { enabled: false, unlocked: true };

  const session = await chrome.storage.session.get(UNLOCKED_KEY);
  return { enabled: true, unlocked: Boolean(session[UNLOCKED_KEY]) };
}

/** Turn the lock on, or change the password. Does not touch the NAS credentials. */
export async function enableSettingsLock(password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const verifier = await deriveVerifier(password, salt);

  await chrome.storage.local.set({
    [ENABLED_KEY]: true,
    [SALT_KEY]: toBase64(salt),
    [VERIFIER_KEY]: verifier,
  });
  // Whoever just set the password is holding the screen; locking them out would be absurd.
  await chrome.storage.session.set({ [UNLOCKED_KEY]: true });
}

export async function disableSettingsLock(): Promise<void> {
  await chrome.storage.local.remove([ENABLED_KEY, SALT_KEY, VERIFIER_KEY]);
  await chrome.storage.session.remove(UNLOCKED_KEY);
}

/** Returns whether the password matched; the unlocked flag is set only on success. */
export async function unlockSettings(password: string): Promise<boolean> {
  const local = await chrome.storage.local.get([ENABLED_KEY, SALT_KEY, VERIFIER_KEY]);
  if (!local[ENABLED_KEY]) return true;

  const salt = typeof local[SALT_KEY] === "string" ? fromBase64(local[SALT_KEY]) : undefined;
  const expected = local[VERIFIER_KEY];
  if (!salt || typeof expected !== "string") {
    // No usable verifier: refusing entry forever would be worse than treating it as unset.
    logger.error("Settings lock is enabled but has no usable verifier — treating it as off");
    await disableSettingsLock();
    return true;
  }

  const actual = await deriveVerifier(password, salt);
  if (!timingSafeEqual(actual, expected)) return false;

  await chrome.storage.session.set({ [UNLOCKED_KEY]: true });
  return true;
}

/** Re-lock the settings screen without disabling the feature. */
export async function lockSettings(): Promise<void> {
  await chrome.storage.session.remove(UNLOCKED_KEY);
}

async function deriveVerifier(password: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

/** Compares in constant time so a wrong password cannot be narrowed down by timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
