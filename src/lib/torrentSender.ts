/**
 * Shared torrent-send logic.
 *
 * The .torrent is fetched in the browser (sending the user's tracker cookies via
 * credentials: "include") and uploaded to the NAS through AddTorrent. Sending the
 * bare URL would fail for private trackers because the NAS has no session there.
 */

import { createApiClient } from "@api/client.js";
import type { Settings } from "./config.js";
import { hasTorrentExtension } from "./sourceKind.js";
import { fetchFromPageContext } from "./tabFetch.js";
import { readTorrentName } from "./torrentMeta.js";

export type SendTorrentResult = {
  name: string;
  duplicate: boolean;
};

/**
 * Fetch a .torrent with the browser's cookies and upload it to the NAS.
 *
 * `folder` overrides the final destination for this task. Pass a function instead of a string
 * to decide the destination once the torrent has been read: it receives the release name
 * declared inside the file, which is the only place that name exists before the NAS has the
 * task. Routing rules need it — the URL alone names the metadata file, not the download.
 */
export async function sendTorrentUrlToNas(
  settings: Settings,
  url: string,
  folder?: string | ((contentName: string | undefined) => string),
  referrer?: string,
): Promise<SendTorrentResult> {
  // A page on the tracker is the only context whose request looks like a real click. The
  // worker's own fetch is the fallback for sources that need no session at all.
  const response = (await fetchFromPageContext(url, referrer)) ?? (await fetch(url, { credentials: "include" }));

  if (!response.ok) {
    throw new Error(
      response.status === 403 || response.status === 401
        ? `The tracker refused the download (HTTP ${response.status}). Open the topic page and make sure you are logged in.`
        : `Fetch torrent failed: HTTP ${response.status}`,
    );
  }

  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assertLooksLikeTorrent(bytes, response);

  const name = torrentFileName(response, url);
  const file = new File([blob], name, { type: "application/x-bittorrent" });

  const targetFolder = typeof folder === "function" ? folder(readTorrentName(bytes)) : folder;
  const client = createApiClient({ settings });
  const result = await client.addTorrent(file, { targetFolder });

  return { name, duplicate: Boolean(result.duplicate) };
}

/**
 * Trackers answer an unauthenticated request with a login page rather than a 4xx, so a
 * successful HTTP status proves nothing. Uploading that HTML would create a task on the NAS
 * for a file that is not a torrent — the symptom this check exists to turn into a real error.
 *
 * A `.torrent` is bencoded, so it always starts with `d` followed by a digit (the first key's
 * length), e.g. `d8:announce`.
 */
function assertLooksLikeTorrent(bytes: Uint8Array, response: Response): void {
  const bencodedDict = bytes[0] === 0x64 && bytes[1] >= 0x30 && bytes[1] <= 0x39; // "d" + digit
  if (bencodedDict) return;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-bittorrent")) return;

  throw new Error(
    contentType.includes("text/html")
      ? "The tracker returned a web page, not a .torrent — you may need to log in to it first."
      : "The downloaded file is not a .torrent.",
  );
}

/**
 * Derive the torrent file name from the HTTP response headers (Content-Disposition)
 * or fallback to the URL pathname, adhering to RFC 6266 and RFC 5987.
 */
function torrentFileName(response: Response, url: string): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const fromHeader = parseContentDispositionFilename(disposition);
  if (fromHeader) {
    const base = fromHeader.split(/[/\\]/).pop()?.trim();
    if (base) return base;
  }

  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").pop();
    if (last) {
      const decoded = decodeURIComponent(last).trim();
      if (hasTorrentExtension(decoded)) return decoded;
    }
  } catch {
    // ignore invalid URL
  }

  return "download.torrent";
}

/**
 * Parse filename from Content-Disposition header according to RFC 6266 / RFC 5987.
 * Gives precedence to `filename*` parameter over `filename`.
 */
function parseContentDispositionFilename(disposition: string): string | undefined {
  if (!disposition) return undefined;

  // RFC 6266 Section 4.3 / RFC 5987 Section 3.2: filename* takes precedence over filename.
  // Format: filename*=charset'[language]'value-chars
  const extMatch = disposition.match(/filename\*\s*=\s*(?:([a-zA-Z0-9_-]+)'([a-zA-Z0-9_-]*)'|["']?)([^;\n"']+)/i);
  if (extMatch) {
    const charset = extMatch[1]?.toUpperCase() ?? "UTF-8";
    const rawVal = extMatch[3]?.trim();
    if (rawVal) {
      try {
        if (charset === "ISO-8859-1" || charset === "LATIN1") {
          return rawVal.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        }
        return decodeURIComponent(rawVal);
      } catch {
        return rawVal;
      }
    }
  }

  // Standard filename parameter: filename="value" or filename=value or filename='value'
  const stdMatch = disposition.match(/filename\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s\n]+))/i);
  const stdVal = stdMatch?.[1] ?? stdMatch?.[2] ?? stdMatch?.[3];
  if (stdVal) {
    const trimmed = stdVal.trim();
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }

  return undefined;
}
