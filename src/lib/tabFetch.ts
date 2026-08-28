/**
 * Fetch a URL from inside a page rather than from the service worker.
 *
 * Trackers guard their download endpoints against hotlinking, and a request issued by the
 * worker fails every check a real click passes: it carries `Origin: chrome-extension://…`,
 * `Sec-Fetch-Site: cross-site`, and no `Referer` at all. The `referrer` request option cannot
 * fix that — the Fetch spec requires it to be same-origin with the request's client, so a
 * tracker URL set from an extension worker is discarded before the request is sent.
 *
 * Running the fetch in a tab that is already on the site removes the difference instead of
 * papering over it: the request originates from the page, so referrer, origin and cookies are
 * exactly what a click would produce.
 */

/** A page-context fetch result, carried back as base64 because only JSON crosses the boundary. */
type TabFetchResult = {
  ok: boolean;
  status: number;
  contentType: string;
  contentDisposition: string;
  base64: string;
};

/**
 * Fetch `url` from a tab on the same origin. Returns undefined when no such tab exists or the
 * injection is not permitted, leaving the caller to fall back to a direct fetch.
 */
export async function fetchFromPageContext(url: string, preferredPageUrl?: string): Promise<Response | undefined> {
  if (!chrome.scripting?.executeScript || !chrome.tabs?.query) return undefined;

  const tabId = await findTabOnOrigin(url, preferredPageUrl);
  if (tabId === undefined) return undefined;

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: fetchInPage,
      args: [url],
    });

    const result = injection?.result as TabFetchResult | undefined;
    if (!result) return undefined;

    return new Response(base64ToBytes(result.base64), {
      status: result.status,
      headers: {
        "content-type": result.contentType,
        "content-disposition": result.contentDisposition,
      },
    });
  } catch (error) {
    console.warn("[QuickGet] page-context fetch unavailable:", error);
    return undefined;
  }
}

/**
 * Runs inside the page. Must be self-contained — it is serialised across the boundary, so it
 * cannot close over anything in this module.
 */
function fetchInPage(target: string): Promise<TabFetchResult> {
  return fetch(target, { credentials: "include" }).then(async (response) => {
    const buffer = await response.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    // Chunked to stay clear of the argument limit on String.fromCharCode for larger torrents.
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }

    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      contentDisposition: response.headers.get("content-disposition") ?? "",
      base64: btoa(binary),
    };
  });
}

/**
 * Prefer the page the download actually started from; any other tab on the same origin is an
 * acceptable stand-in, since what matters is that the request originates on the site.
 */
async function findTabOnOrigin(url: string, preferredPageUrl?: string): Promise<number | undefined> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return undefined;
  }

  const tabs = await chrome.tabs.query({ url: `${origin}/*` });
  if (tabs.length === 0) return undefined;

  const preferred = preferredPageUrl ? tabs.find((tab) => tab.url === preferredPageUrl) : undefined;
  return (preferred ?? tabs[0]).id;
}

function base64ToBytes(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return buffer;
}
