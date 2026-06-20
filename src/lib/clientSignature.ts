import type { Settings } from "./config.js";

/**
 * Stable signature of the settings that affect the API client / connection
 * identity. Used to decide when a cached `ApiClient` must be rebuilt. Excludes
 * UI-only fields (intercept mode, routing rules, rememberPassword) that don't
 * change how requests are sent.
 */
export function clientSignature(settings: Settings): string {
  return JSON.stringify([
    settings.NASsecure,
    settings.NASaddress,
    settings.NASport,
    settings.NASlogin,
    settings.NASpassword,
    settings.NAStempdir,
    settings.NASdir,
  ]);
}
