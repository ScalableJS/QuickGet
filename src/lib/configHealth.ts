/**
 * What must be filled in for a download to have any chance of reaching the NAS.
 *
 * These are not preferences. A task cannot be created without a temporary folder, and the NAS
 * cannot be reached without an address and credentials — an empty one turns every download into
 * a failure that names an API field rather than a setting. Checking them in one place means the
 * problem can be reported before the attempt instead of after it.
 */

import type { Settings } from "./config.js";

export type ConfigProblem = {
  /** Labels as they appear in Settings, so the message points at something the user can find. */
  missing: string[];
  summary: string;
};

export function findConfigProblem(settings: Settings): ConfigProblem | undefined {
  const missing: string[] = [];

  if (!settings.NASaddress.trim()) missing.push("Server address");
  if (!settings.NASlogin.trim()) missing.push("Username");
  if (!settings.NASpassword) missing.push("Password");
  if (!settings.NAStempdir.trim()) missing.push("Temp Folder");

  if (missing.length === 0) return undefined;

  return {
    missing,
    summary:
      missing.length === 1
        ? `${missing[0]} is not set in Settings.`
        : `Not set in Settings: ${missing.join(", ")}.`,
  };
}
