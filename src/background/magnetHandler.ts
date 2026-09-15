/**
 * Background handler for magnet link clicks intercepted by content script.
 */

import { createApiClient } from "@api/client.js";
import { getErrorMessage } from "@lib/errors.js";
import { resolveDestination } from "@lib/routingRules.js";
import { loadSettings } from "@lib/settings.js";
import { magnetDisplayName } from "@lib/sourceKind.js";
import { markConfigurationProblem } from "./actions.js";
import { ensureMonitoring } from "./alarms.js";

export async function handleMagnetAdd(
  uri: string,
  /** The page the magnet was clicked on. A magnet has no host of its own, so this is the only
   *  thing a domain rule can match — and the content script has always sent it. */
  pageUrl?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const settings = await loadSettings();
    const targetFolder = resolveDestination(
      { url: uri, kind: "magnet", pageUrl, name: magnetDisplayName(uri) },
      settings.routingRules,
      settings.NASdir,
    );

    console.log("[QuickGet] magnet interception send", { uri, pageUrl, targetFolder });

    const client = createApiClient({ settings });
    await client.addUrl(uri, { targetFolder });

    void ensureMonitoring();
    return { ok: true };
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    console.error("[QuickGet] magnet send failed:", error);
    await markConfigurationProblem(errorMsg);
    return { ok: false, error: errorMsg };
  }
}
