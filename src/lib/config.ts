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

const FALLBACK_DEFAULTS: Settings = {
  NASsecure: false,
  NASaddress: "downloadstation.local",
  NASport: "8080",
  NASlogin: "download",
  NASpassword: "",
  NAStempdir: "/share/Download",
  NASdir: "/share/Multimedia/Movies",
  enableDebugLogging: false,
};

const envString = (value: string | undefined, fallback: string): string => {
  const normalized = (value ?? "").trim();
  return normalized || fallback;
};

const envBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0" || normalized === "") return false;
  return fallback;
};

export const DEFAULTS: Settings = {
  NASsecure: envBoolean(import.meta.env.VITE_QNAP_SECURE, FALLBACK_DEFAULTS.NASsecure),
  NASaddress: envString(import.meta.env.VITE_QNAP_ADDRESS, FALLBACK_DEFAULTS.NASaddress),
  NASport: envString(import.meta.env.VITE_QNAP_PORT, FALLBACK_DEFAULTS.NASport),
  NASlogin: envString(import.meta.env.VITE_QNAP_LOGIN, FALLBACK_DEFAULTS.NASlogin),
  NASpassword: envString(import.meta.env.VITE_QNAP_PASSWORD, FALLBACK_DEFAULTS.NASpassword),
  NAStempdir: envString(import.meta.env.VITE_QNAP_TEMP_DIR, FALLBACK_DEFAULTS.NAStempdir),
  NASdir: envString(import.meta.env.VITE_QNAP_DEST_DIR, FALLBACK_DEFAULTS.NASdir),
  enableDebugLogging: FALLBACK_DEFAULTS.enableDebugLogging,
};

export const DEBUG_ENABLED = false; // set to true for verbose logging
