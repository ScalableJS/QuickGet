/**
 * Configuration module - centralized defaults and types
 * Single source of truth for all configuration values
 */

import type { RoutingRule } from "./routingRules.js";

/** Valid torrent-intercept modes — the single source of truth for runtime validation. */
export const INTERCEPT_MODES = ["off", "always"] as const;
export type TorrentInterceptMode = (typeof INTERCEPT_MODES)[number];

/** Valid theme preferences — "auto" follows the OS color-scheme. */
export const THEME_MODES = ["auto", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export type Settings = {
  NASsecure: boolean;
  NASaddress: string; // e.g. "192.168.88.185" or hostname
  NASport: string; // e.g. "8080"
  NASlogin: string;
  NASpassword: string; // kept in session storage; encrypted at rest when "remember" is on
  NAStempdir: string; // temporary folder on NAS
  NASdir: string; // final destination folder on NAS
  torrentInterceptMode: TorrentInterceptMode; // how to handle .torrent downloads
  routingRules: RoutingRule[]; // per-download destination overrides, first match wins
  rememberPassword: boolean;
  theme: ThemeMode; // popup color theme; "auto" follows the OS
};

const FALLBACK_DEFAULTS: Settings = {
  NASsecure: false,
  NASaddress: "downloadstation.local",
  NASport: "8080",
  NASlogin: "download",
  NASpassword: "",
  NAStempdir: "Download", // relative to the share root — DS rejects absolute /share/... paths
  NASdir: "Multimedia/Movies",
  torrentInterceptMode: "always",
  routingRules: [],
  rememberPassword: false,
  theme: "auto",
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
  torrentInterceptMode: FALLBACK_DEFAULTS.torrentInterceptMode,
  routingRules: [],
  rememberPassword: false,
  theme: FALLBACK_DEFAULTS.theme,
};
