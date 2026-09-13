import { networkInterfaces } from "node:os";

/**
 * The address on this machine that a NAS on the same network can actually reach.
 *
 * Download Station fetches a URL itself, from its own machine, so anything handed to it must name
 * *this* host on the LAN. Getting it wrong is not a subtle failure — `http://127.0.0.1/...` asks
 * the NAS to download from its own loopback and it answers `12288`, "does not support this URL",
 * which reads as a broken extension.
 *
 * A laptop typically has several non-internal IPv4 addresses: Wi-Fi, Ethernet, a VPN tunnel, and
 * one per Docker or VM bridge. Only the first kind is routable from the NAS, so the bridges and
 * tunnels are excluded by their well-known ranges rather than by hoping the first entry is right.
 */

/** Docker's default bridge, and the link-local range a machine assigns itself when DHCP fails. */
const UNREACHABLE_RANGES = [
  /^172\.1[6-9]\./,
  /^172\.2\d\./,
  /^172\.3[01]\./,
  /^169\.254\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter(
      (entry): entry is NonNullable<typeof entry> => entry !== undefined && entry.family === "IPv4" && !entry.internal,
    )
    .map((entry) => entry.address);
}

/** The single best candidate, or a thrown error naming what was rejected and why. */
export function lanAddress(): string {
  const all = lanAddresses();
  const candidates = all.filter((address) => !UNREACHABLE_RANGES.some((range) => range.test(address)));

  if (candidates.length === 0) {
    throw new Error(
      `No LAN address to advertise to the NAS. Interfaces seen: ${all.join(", ") || "none"}. ` +
        `A NAS cannot fetch from loopback, a Docker bridge or a VPN tunnel.`,
    );
  }
  if (candidates.length > 1) {
    // Ambiguity is worth saying out loud rather than resolving silently: if the NAS turns out to be
    // unreachable, the run's own output already names the other addresses that were available.
    console.log(
      `[spot check] using ${candidates[0]} as this machine's LAN address (also found: ${candidates.slice(1).join(", ")})`,
    );
  }
  return candidates[0];
}
