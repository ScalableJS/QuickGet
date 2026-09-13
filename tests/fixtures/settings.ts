import type { Settings } from "@lib/config.js";

export function createTestSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    NASsecure: false,
    NASaddress: "nas.local",
    NASport: "8080",
    NASlogin: "admin",
    NASpassword: "secret",
    NAStempdir: "/share/Download",
    NASdir: "/share/Multimedia/Movies",
    interceptTorrentLinks: true,
    interceptFileLinks: false,
    routingRules: [],
    theme: "auto",
    ...overrides,
  };
}
