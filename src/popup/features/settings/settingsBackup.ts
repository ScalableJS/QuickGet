import type { Settings } from "@lib/config.js";
import type { RoutingMatchType, RoutingRule } from "@lib/routingRules.js";

const BACKUP_APP = "quickget-remote";
const BACKUP_VERSION = 1;

// Keys safe to export/import. Credentials (NASpassword, rememberPassword) are
// intentionally excluded so a backup file never carries secrets.
const PORTABLE_KEYS = [
  "NASsecure",
  "NASaddress",
  "NASport",
  "NASlogin",
  "NAStempdir",
  "NASdir",
  "torrentInterceptMode",
  "routingRules",
] as const;

export type SettingsBackup = {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  settings: Partial<Settings>;
};

/** Serialize the portable (non-secret) settings to a pretty JSON backup string. */
export function exportSettings(settings: Settings, now: Date = new Date()): string {
  const subset: Partial<Settings> = {};
  for (const key of PORTABLE_KEYS) {
    (subset as Record<string, unknown>)[key] = settings[key];
  }
  const backup: SettingsBackup = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    settings: subset,
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * Parse an imported backup string into a validated settings patch. Accepts both
 * our wrapped format (`{ settings: {...} }`) and a bare settings object. Throws
 * on invalid JSON or a non-object payload; silently drops unknown/ill-typed keys.
 */
export function parseImportedSettings(text: string): Partial<Settings> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Not a valid JSON file");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Backup file is not an object");
  }

  const root = parsed as Record<string, unknown>;
  const source = (typeof root.settings === "object" && root.settings !== null ? root.settings : root) as Record<
    string,
    unknown
  >;

  const result: Partial<Settings> = {};
  if (typeof source.NASsecure === "boolean") result.NASsecure = source.NASsecure;
  if (typeof source.NASaddress === "string") result.NASaddress = source.NASaddress;
  if (typeof source.NASport === "string") result.NASport = source.NASport;
  if (typeof source.NASlogin === "string") result.NASlogin = source.NASlogin;
  if (typeof source.NAStempdir === "string") result.NAStempdir = source.NAStempdir;
  if (typeof source.NASdir === "string") result.NASdir = source.NASdir;
  if (source.torrentInterceptMode === "off" || source.torrentInterceptMode === "ask" || source.torrentInterceptMode === "always") {
    result.torrentInterceptMode = source.torrentInterceptMode;
  }
  const rules = sanitizeRules(source.routingRules);
  if (rules) result.routingRules = rules;

  if (Object.keys(result).length === 0) {
    throw new Error("No recognizable settings in the file");
  }
  return result;
}

const MATCH_TYPES: readonly RoutingMatchType[] = ["url", "magnet", "torrent"];

function sanitizeRules(raw: unknown): RoutingRule[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const rules: RoutingRule[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.destination !== "string") continue;
    const rule: RoutingRule = { destination: candidate.destination };
    if (typeof candidate.type === "string" && (MATCH_TYPES as string[]).includes(candidate.type)) {
      rule.type = candidate.type as RoutingMatchType;
    }
    if (typeof candidate.namePattern === "string") rule.namePattern = candidate.namePattern;
    if (typeof candidate.domain === "string") rule.domain = candidate.domain;
    rules.push(rule);
  }
  return rules;
}
