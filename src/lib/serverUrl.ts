import type { Settings } from "./config.js";

/** Connection fields a server URL maps to. */
export type ServerUrlParts = Pick<Settings, "NASsecure" | "NASaddress" | "NASport">;

/**
 * Compose a single "Server address" string from the stored protocol/host/port.
 * Returns "" when no address is set.
 */
export function composeServerUrl(s: ServerUrlParts): string {
  const protocol = s.NASsecure ? "https" : "http";
  const address = String(s.NASaddress || "").trim();
  if (!address) return "";
  const port = String(s.NASport || "").trim();
  return port ? `${protocol}://${address}:${port}` : `${protocol}://${address}`;
}

/**
 * Parse a pasted server address (with or without scheme) into protocol/host/port.
 * Throws if the address is empty or unusable.
 */
export function parseServerUrl(raw: string): ServerUrlParts {
  const input = raw.trim();
  if (!input) throw new Error("Server address is empty.");
  const withScheme = /^[a-z][\w+.-]*:\/\//i.test(input) ? input : `http://${input}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Invalid server address. Example: http://192.168.88.185:8080");
  }
  if (!url.hostname) throw new Error("Invalid server address. Example: http://192.168.88.185:8080");

  return {
    NASsecure: url.protocol === "https:",
    NASaddress: url.hostname,
    NASport: url.port, // empty string when no explicit port
  };
}
