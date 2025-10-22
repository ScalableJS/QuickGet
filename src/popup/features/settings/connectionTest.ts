import { createApiClient } from "@api/client.js";
import type { Settings } from "@lib/config.js";

export async function testConnection(settings: Settings): Promise<boolean> {
  const client = createApiClient({ settings });
  return client.testConnection();
}
