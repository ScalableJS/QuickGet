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
  NASaddress: string; // e.g. "192.168.1.100" or hostname
  NASport: string; // e.g. "8080"
  NASlogin: string;
  NASpassword: string; // kept in session storage; encrypted at rest when "remember" is on
  NAStempdir: string; // temporary folder on NAS
  NASdir: string; // final destination folder on NAS
  torrentInterceptMode: TorrentInterceptMode; // how to handle .torrent downloads
  /**
   * Cancel at the filename stage before Chrome can show "Save as" or leave the `.torrent` in
   * Downloads. The NAS hand-off then re-fetches the URL; if it fails, the user clicks again.
   * Chrome-only: Firefox has no `downloads.onDeterminingFilename` (Bugzilla 1245652, open since
   * 2016), and there it is simply ignored. Off by default — see DEFAULTS.
   */
  suppressLocalTorrentFile: boolean;
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
  torrentInterceptMode: "always",
  /**
   * Off by default deliberately. The permissive path (pause → hand off → cancel) fails
   * benignly: an unreachable NAS just resumes the browser download and the user still gets
   * their file. Strict mode cancels that fallback before it re-fetches the URL for the NAS, so
   * a failed hand-off requires a deliberate retry instead. That trade-off stays the user's
   * choice, not ours.
   */
  suppressLocalTorrentFile: false,
  routingRules: [],
  theme: "auto",
};
