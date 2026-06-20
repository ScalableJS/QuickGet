import type { ApiClient } from "@api/client.js";
import { createApiClient } from "@api/client.js";
import { clientSignature } from "@lib/clientSignature.js";
import type { Settings } from "@lib/config.js";
import { loadSettings } from "@lib/settings.js";

type CachedClient = {
  signature: string;
  client: ApiClient;
};

let clientCache: CachedClient | null = null;

export async function getApiClient(options?: { settings?: Settings }): Promise<ApiClient> {
  // Explicit settings come from transient, unsaved form state (Test Connection,
  // folder picker). Build a throwaway client so we never poison the shared cache
  // — the cache is keyed by signature and a saved client could otherwise be
  // overwritten by one carrying unconfirmed settings.
  if (options?.settings) {
    return createApiClient({ settings: options.settings });
  }

  const settings = await loadSettings();
  const signature = clientSignature(settings);

  if (!clientCache || clientCache.signature !== signature) {
    clientCache = {
      signature,
      client: createApiClient({ settings }),
    };
  }

  return clientCache.client;
}

export function invalidateClientCache(): void {
  clientCache = null;
}
