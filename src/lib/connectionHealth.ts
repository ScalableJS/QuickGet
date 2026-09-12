/**
 * What the NAS last told us, kept separately from whether the extension is configured.
 *
 * These are two different questions and conflating them produces a lying interface. A SID is a
 * runtime cache: it can expire a minute after a successful login while the saved address,
 * username and password stay perfectly correct. Calling that "disconnected" would send the user
 * back to a form to retype settings that were never wrong.
 *
 * So: configuration is "are the settings filled in", health is "what happened last time we
 * tried". No SID appears here, and the UI never asks whether one exists.
 */

import { buildNASBaseUrl, loginErrorCode, performLogin } from "@api/index.js";

import type { Settings } from "./config.js";
import { findConfigProblem } from "./configHealth.js";

export type HealthKind = "unknown" | "ready" | "unreachable" | "auth-failed";

export type ConnectionHealth = {
  kind: HealthKind;
  lastCheckedAt?: number;
  lastSuccessAt?: number;
  /** Message from the last failure, for display. */
  detail?: string;
};

export type ConnectionState = {
  configured: boolean;
  health: ConnectionHealth;
};

export async function readConnectionState(settings: Settings): Promise<ConnectionState> {
  return { configured: findConfigProblem(settings) === undefined, health: { kind: "unknown" } };
}

/**
 * How long the connection test waits before calling the NAS absent.
 *
 * Deliberately shorter than `LOGIN_TIMEOUT_MS`: this is the one request a user is sitting in
 * front of, watching a button. A NAS on the same LAN answers a login in tens of milliseconds, so
 * five seconds is already generous — and an answer of "not reachable" that arrives in five
 * seconds is worth more than a correct one that arrives in thirty.
 */
export const PING_TIMEOUT_MS = 5_000;

export type PingOptions = {
  timeoutMs?: number;
};

/**
 * Ask the NAS one question — "will you log me in right now?" — and turn the answer into health.
 *
 * A login is the whole test. It is the cheapest request Download Station has, every other call
 * begins with one anyway, and its three outcomes are exactly the three states worth telling
 * apart: a SID means ready, error 4 means the credentials are wrong, and no answer at all means
 * the NAS is not there. Testing with a task query instead cost a second round-trip to learn
 * nothing more, and left the verdict to be guessed from the text of whatever error came back.
 *
 * Never throws: a failed check is a result, not an exception. Callers render what they get.
 */
export async function pingNas(settings: Settings, options: PingOptions = {}): Promise<ConnectionHealth> {
  const timeoutMs = options.timeoutMs ?? PING_TIMEOUT_MS;

  try {
    await performLogin(settings, { signal: AbortSignal.timeout(timeoutMs) });
    const now = Date.now();
    return { kind: "ready", lastCheckedAt: now, lastSuccessAt: now };
  } catch (error) {
    return connectionFailure(error, { address: describeAddress(settings), timeoutMs });
  }
}

export type FailureContext = {
  /** Shown to the user so "unreachable" names the thing that could not be reached. */
  address?: string;
  timeoutMs?: number;
};

/** Describe only the result of the request that just completed; nothing is persisted. */
export function connectionFailure(error: unknown, context: FailureContext = {}): ConnectionHealth {
  const kind = classify(error);
  return { kind, lastCheckedAt: Date.now(), detail: describe(error, kind, context) };
}

/**
 * Rejected credentials need the user; an unreachable NAS usually just needs time. Telling them
 * apart is the difference between "check your password" and "your NAS is off".
 *
 * A code means Download Station itself answered the login and declined it — whatever the reason,
 * the NAS is plainly reachable, so reporting that as "unreachable" would send the user looking at
 * the wrong thing. The text match after it is the fallback for failures raised elsewhere, where
 * no code was ever attached.
 */
function classify(error: unknown): HealthKind {
  const code = loginErrorCode(error);
  if (code !== undefined && code >= 0) return "auth-failed";

  if (readMessage(error).toLowerCase().includes("username or password")) {
    return "auth-failed";
  }
  return "unreachable";
}

/**
 * What the user reads. "Failed to fetch" is the browser talking to itself; it names neither what
 * was being reached nor what to do about it.
 */
function describe(error: unknown, kind: HealthKind, context: FailureContext): string {
  const raw = readMessage(error);
  if (kind === "auth-failed") return raw;

  const target = context.address ?? "the NAS";

  if (isTimeout(error)) {
    const seconds = Math.round((context.timeoutMs ?? PING_TIMEOUT_MS) / 1000);
    return `${target} did not answer within ${seconds} s. It may be asleep or on another network.`;
  }

  // `TypeError: Failed to fetch` is what a refused connection, a DNS miss and a blocked port all
  // look like from inside the page — indistinguishable by design, so the message covers all three.
  if (error instanceof TypeError) {
    return `Could not reach ${target}. Check that the NAS is switched on and the address is right.`;
  }

  return raw;
}

/**
 * An aborted `fetch` rejects with a `DOMException`, which — despite carrying `name`, `message`
 * and a stack — is not an `Error` subclass in any browser. Reading the fields directly is the
 * only check that holds for both it and an ordinary Error.
 */
function isTimeout(error: unknown): boolean {
  const name = readField(error, "name");
  return name === "TimeoutError" || name === "AbortError";
}

function readMessage(error: unknown): string {
  return readField(error, "message") ?? String(error);
}

function readField(error: unknown, field: "name" | "message"): string | undefined {
  if (typeof error !== "object" || error === null || !(field in error)) return undefined;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

function describeAddress(settings: Settings): string | undefined {
  try {
    return buildNASBaseUrl(settings).replace(/^https?:\/\//, "");
  } catch {
    // An address too malformed to build a URL from is its own error message; the caller will
    // show that instead of a host it could not name.
    return undefined;
  }
}
