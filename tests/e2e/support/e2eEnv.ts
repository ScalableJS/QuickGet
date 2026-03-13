import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface RealNasEnv {
  enabled: boolean;
  allowMutations: boolean;
  captureHttp: boolean;
  secure: boolean;
  host: string;
  port: string;
  login: string;
  password: string;
  tempDir: string;
  destDir: string;
}

function parseDotEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};

  const text = readFileSync(filePath, "utf8");
  const entries: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries[key] = value;
  }

  return entries;
}

function envFlag(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function loadRealNasEnv(rootDir: string): RealNasEnv {
  const localEnv = parseDotEnvFile(path.join(rootDir, ".env.e2e.local"));
  const merged = { ...localEnv, ...process.env } as Record<string, string | undefined>;

  return {
    enabled: envFlag(merged.QNAP_E2E_REAL, false),
    allowMutations: envFlag(merged.QNAP_E2E_ALLOW_MUTATIONS, false),
    captureHttp: envFlag(merged.QNAP_E2E_CAPTURE_HTTP, true),
    secure: envFlag(merged.QNAP_E2E_HTTPS, false),
    host: merged.QNAP_E2E_HOST ?? "",
    port: merged.QNAP_E2E_PORT ?? "",
    login: merged.QNAP_E2E_LOGIN ?? "",
    password: merged.QNAP_E2E_PASSWORD ?? "",
    tempDir: merged.QNAP_E2E_TEMP_DIR ?? "",
    destDir: merged.QNAP_E2E_DEST_DIR ?? "",
  };
}

export function hasRequiredRealNasEnv(env: RealNasEnv): boolean {
  return Boolean(env.host && env.port && env.login && env.password);
}

