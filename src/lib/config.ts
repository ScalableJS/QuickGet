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

export const DEFAULTS: Settings = {
  NASsecure: false,
  NASaddress: "",
  NASport: "",
  NASlogin: "",
  NASpassword: "",
  NAStempdir: "",
  NASdir: "",
  torrentInterceptMode: "off",
  routingRules: [],
  rememberPassword: false,
  theme: "auto",
};
