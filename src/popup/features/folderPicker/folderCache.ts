import type { DirEntry } from "@api/client.js";
import type { Settings } from "@lib/config.js";

import { getApiClient } from "../../shared/api";

const TTL_MS = 5 * 60 * 1000; // top-level folder list rarely changes

interface CacheEntry {
  signature: string;
  expires: number;
  entries: DirEntry[];
}

let cache: CacheEntry | null = null;

// Tie the cache to the connection identity so it drops when the NAS/login changes.
function signatureOf(settings?: Settings): string {
  if (!settings) return "default";
  return [settings.NASsecure, settings.NASaddress, settings.NASport, settings.NASlogin].join("|");
}

/**
 * Top-level NAS folders, cached for TTL_MS. Pass `force` to bypass the cache
 * (e.g. a manual refresh button).
 */
export async function getTopLevelFolders(settings?: Settings, force = false): Promise<DirEntry[]> {
  const signature = signatureOf(settings);
  const now = Date.now();

  if (!force && cache && cache.signature === signature && cache.expires > now) {
    return cache.entries;
  }

  const client = await getApiClient(settings ? { settings } : undefined);
  const entries = await client.listDir("");
  cache = { signature, expires: now + TTL_MS, entries };
  return entries;
}

export function invalidateFolderCache(): void {
  cache = null;
}
