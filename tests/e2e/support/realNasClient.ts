import path from "node:path";
import { fileURLToPath } from "node:url";

import { createApiClient } from "../../../src/api/client.js";
import type { Settings } from "../../../src/lib/config.js";
import type { Task } from "../../../src/lib/tasks.js";

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
    enableDebugLogging: false,
  };
}

export function createRealNasClient(env: RealNasEnv) {
  return createApiClient({ settings: toRealNasSettings(env), fetchFn: fetch });
}

export async function findTasksByPrefix(env: RealNasEnv, prefix: string): Promise<Task[]> {
  const client = createRealNasClient(env);
  const { tasks } = await client.queryTasks({ params: { limit: 0 } });
  const loweredPrefix = prefix.toLowerCase();
  return tasks.filter((task) => task.name.toLowerCase().startsWith(loweredPrefix));
}

export async function cleanupTasksByPrefix(env: RealNasEnv, prefix: string): Promise<number> {
  const client = createRealNasClient(env);
  const tasks = await findTasksByPrefix(env, prefix);
  for (const task of tasks) {
    const identifier = task.hash ?? task.id;
    if (!identifier) continue;
    await client.removeTask(identifier, { clean: false });
  }
  return tasks.length;
}

export { rootDir };
