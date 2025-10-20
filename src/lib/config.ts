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

export const DEFAULTS: Settings = {
  NASsecure: false,
  NASaddress: "192.168.88.185",
  NASport: "8080",
  NASlogin: "admin",
  NASpassword: "", // leave empty by default for security
  NAStempdir: "Download",
  NASdir: "Movies",
  enableDebugLogging: false,
};

export const API_ENDPOINTS = {
  AUTH_PROBE: "/cgi-bin/authLogin.cgi",
  LOGIN: "/downloadstation/V4/Misc/Login",
  TASK_QUERY: "/downloadstation/V4/Task/Query",
  TASK_ADD_URL: "/downloadstation/V4/Task/AddUrl",
  TASK_ADD: "/downloadstation/V4/Task/Add",
  TASK_ADD_TORRENT: "/downloadstation/V4/Task/AddTorrent",
  TASK_ADD_TASK: "/downloadstation/V4/Task/AddTask",
  TASK_REMOVE: "/downloadstation/V4/Task/Remove",
} as const;

export const DEBUG_ENABLED = false; // set to true for verbose logging
