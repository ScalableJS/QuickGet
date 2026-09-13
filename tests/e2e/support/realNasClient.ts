import path from "node:path";
import { fileURLToPath } from "node:url";

import { createApiClient } from "../../../src/api/client.js";
import type { Settings } from "../../../src/lib/config.js";

import type { RealNasEnv } from "./e2eEnv.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");

export function toRealNasSettings(env: RealNasEnv): Settings {
  return {
    NASsecure: env.secure,
    NASaddress: env.host,
    NASport: env.port,
    NASlogin: env.login,
    NASpassword: env.password,
    NAStempdir: env.tempDir,
    NASdir: env.destDir,
    interceptTorrentLinks: true,
    interceptFileLinks: false,
    routingRules: [],
    theme: "auto",
  };
}

export function createRealNasClient(env: RealNasEnv) {
  return createApiClient({ settings: toRealNasSettings(env), fetchFn: fetch });
}

export { rootDir };
