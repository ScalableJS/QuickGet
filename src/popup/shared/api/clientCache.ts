import type { ApiClient } from "@api/client.js";
import { createApiClient } from "@api/client.js";
import type { Settings } from "@lib/config.js";
import { loadSettings } from "@lib/settings.js";

type ClientSignature = string;

interface CachedClient {
  signature: ClientSignature;
  client: ApiClient;
}

let clientCache: CachedClient | null = null;

function serializeSettings(settings: Settings): ClientSignature {
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

export async function getApiClient(options?: { settings?: Settings }): Promise<ApiClient> {
  const settings = options?.settings ?? (await loadSettings());
  const signature = serializeSettings(settings);

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
