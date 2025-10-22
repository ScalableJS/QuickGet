import type { ApiClient, ApiClientOptions } from "@api/client.js";
import { createApiClient } from "@api/client.js";
import type { Settings } from "@lib/config.js";
import { loadSettings } from "@lib/settings.js";

type ClientSignature = string;

interface CachedClient {
  signature: ClientSignature;
  client: ApiClient;
}

let clientCache: CachedClient | null = null;
let defaultLogger: ApiClientOptions["logger"] | undefined;

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

export async function getApiClient(options?: { settings?: Settings; logger?: ApiClientOptions["logger"] }): Promise<ApiClient> {
  const settings = options?.settings ?? (await loadSettings());
  const signature = serializeSettings(settings);
  const logger = options?.logger ?? defaultLogger;

  if (!clientCache || clientCache.signature !== signature) {
    clientCache = {
      signature,
      client: createApiClient({ settings, logger }),
    };
  } else if (logger) {
    clientCache.client.setLoggerEnabled(true);
  }

  return clientCache.client;
}

export function setDefaultClientLogger(logger: ApiClientOptions["logger"] | undefined): void {
  defaultLogger = logger;
  if (clientCache && logger) {
    clientCache.client.setLoggerEnabled(true);
  }
}

export function invalidateClientCache(): void {
  clientCache = null;
}
