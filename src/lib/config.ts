/**
 * Configuration module - centralized defaults and types
 * Single source of truth for all configuration values
 */

export type Settings = {
  NASsecure: boolean;
  NASaddress: string; // e.g. "192.168.88.185" or hostname
  NASport: string; // e.g. "8080"
  NASlogin: string;
  NASpassword: string; // stored locally only
  NAStempdir: string; // temporary folder on NAS
  NASdir: string; // final destination folder on NAS
  enableDebugLogging: boolean;
};

const envString = (value: string | undefined): string => (value ?? "").trim();

const envBoolean = (value: string | undefined): boolean => {
  if (value == null) return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0" || normalized === "") return false;
  return Boolean(normalized);
};

export const DEFAULTS: Settings = {
  NASsecure: envBoolean(import.meta.env.VITE_QNAP_SECURE),
  NASaddress: envString(import.meta.env.VITE_QNAP_ADDRESS),
  NASport: envString(import.meta.env.VITE_QNAP_PORT),
  NASlogin: envString(import.meta.env.VITE_QNAP_LOGIN),
  NASpassword: envString(import.meta.env.VITE_QNAP_PASSWORD),
  NAStempdir: envString(import.meta.env.VITE_QNAP_TEMP_DIR),
  NASdir: envString(import.meta.env.VITE_QNAP_DEST_DIR),
  enableDebugLogging: false,
};

export const DEBUG_ENABLED = false; // set to true for verbose logging
