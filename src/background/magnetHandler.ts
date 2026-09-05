/**
 * Background handler for magnet link clicks intercepted by content script.
 */

import { createApiClient } from "@api/client.js";
import { getErrorMessage } from "@lib/errors.js";
import { classifyUrl, resolveDestination } from "@lib/routingRules.js";
import { loadSettings } from "@lib/settings.js";
import { markConfigurationProblem } from "./actions.js";
import { ensureMonitoring } from "./alarms.js";

// TTL deduplication cache (5 seconds)
const recentMagnets = new Map<string, number>();
const DEDUP_TTL_MS = 5_000;

export async function handleMagnetAdd(
  uri: string,
): Promise<{ ok: boolean; error?: string; deduped?: boolean }> {
  const now = Date.now();
  const lastSeen = recentMagnets.get(uri);
  if (lastSeen && now - lastSeen < DEDUP_TTL_MS) {
    return { ok: true, deduped: true };
  }
  recentMagnets.set(uri, now);

  for (const [key, timestamp] of recentMagnets) {
    if (now - timestamp > DEDUP_TTL_MS) {
      recentMagnets.delete(key);
    }
  }

  try {
    const settings = await loadSettings();
    const targetFolder = resolveDestination(
      { url: uri, kind: classifyUrl(uri) },
      settings.routingRules,
      settings.NASdir,
    );

    console.log("[QuickGet] magnet interception send", { uri, targetFolder });

    const client = createApiClient({ settings });
    await client.addUrl(uri, { targetFolder });

    void ensureMonitoring();
    return { ok: true };
  } catch (error) {
    recentMagnets.delete(uri);
    const errorMsg = getErrorMessage(error);
    console.error("[QuickGet] magnet send failed:", error);
    await markConfigurationProblem(errorMsg);
    return { ok: false, error: errorMsg };
  }
}
