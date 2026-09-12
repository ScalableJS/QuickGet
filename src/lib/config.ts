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
   * Send torrent links to Download Station without being asked — `.torrent` downloads and
   * `magnet:` clicks alike.
   *
   * One switch, because the two were never two ideas: they are two Chrome APIs for the same
   * intent, and they used to carry opposite defaults for no reason anyone could name. Whether a
   * local copy is left behind is not a choice either — it is what the browser allows. Chrome
   * cancels at the filename stage so nothing reaches Downloads; Firefox has no
   * `downloads.onDeterminingFilename` (Bugzilla 1245652, open since 2016) and keeps the older
   * pause-and-cancel path, where a small file can still land.
   *
   * Off is not a dead end: Shift-clicking a link sends that one regardless.
   */
  interceptTorrentLinks: boolean;
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
  /**
   * On, because a NAS client that waits to be asked before doing its one job is a worse
   * default than one that acts. The risk that once justified caution is handled elsewhere: a
   * live NAS login runs before the browser transfer is touched, so an unreachable NAS leaves
   * the download alone entirely rather than cancelling it (BUG-33).
   */
  interceptTorrentLinks: true,
  routingRules: [],
  theme: "auto",
};
