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

/** Describe only the result of the request that just completed; nothing is persisted. */
export function connectionFailure(error: unknown): ConnectionHealth {
  const detail = error instanceof Error ? error.message : String(error);
  return { kind: classify(detail), lastCheckedAt: Date.now(), detail };
}

/**
 * Rejected credentials need the user; an unreachable NAS usually just needs time. Telling them
 * apart is the difference between "check your password" and "your NAS is off".
 */
function classify(detail: string): HealthKind {
  const message = detail.toLowerCase();
  if (message.includes("username or password") || message.includes("login failed")) {
    return "auth-failed";
  }
  return "unreachable";
}
