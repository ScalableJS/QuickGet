/**
 * Configuration module - centralized defaults and types
 * Single source of truth for all configuration values
 */

import type { RoutingRule } from "./routingRules.js";

/** Valid theme preferences — "auto" follows the OS color-scheme. */
export const THEME_MODES = ["auto", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export type Settings = {
  NASsecure: boolean;
  NASaddress: string; // e.g. "192.168.1.100" or hostname
  NASport: string; // e.g. "8080"
  NASlogin: string;
  NASpassword: string; // kept in session storage; encrypted at rest when "remember" is on
  NAStempdir: string; // temporary folder on NAS
  NASdir: string; // final destination folder on NAS
  /**
   * Whether an ordinary click on a link to a plain file — ISO, ZIP, MKV and the rest of
   * `DOWNLOADABLE_FILE_EXTENSIONS` — is sent to Download Station instead of the browser, at any
   * size (RES-5).
   *
   * **Off by default.** Torrent files and magnets always belong to Download Station; this setting
   * changes what happens to ordinary web downloads, so it has to be asked for. Shift-click sends
   * one eligible ordinary file while the setting is off.
   *
   * Phase 1 serves plain links only. A link behind a login, or one that redirects, is still
   * intercepted — nothing in a click handler can tell it apart without a request — and if
   * Download Station cannot fetch it the task fails there, visibly.
   */
  interceptFileLinks: boolean;
  routingRules: RoutingRule[]; // per-download destination overrides, first match wins
  theme: ThemeMode; // popup color theme; "auto" follows the OS
};

export const DEFAULTS: Settings = {
  NASsecure: false,
  NASaddress: "",
  NASport: "",
  NASlogin: "",
  NASpassword: "",
  /**
   * QNAP creates a `Download` share when the NAS is initialised, so it exists on essentially
   * every install — verified against a live QTS 5 NAS, where it is listed alongside Public,
   * Multimedia, Music, Web and home.
   *
   * It is pre-filled because Download Station *requires* a temporary folder and answers an
   * empty one with `{error: 1, reason: "temp"}` — an API field name that tells the user
   * nothing. Leaving it blank made the common case fail by default. The folder is still
   * validated against the NAS, so an install without it gets a real message rather than a
   * silent failure.
   */
  NAStempdir: "Download",
  NASdir: "Download",
  interceptFileLinks: false,
  routingRules: [],
  theme: "auto",
};
