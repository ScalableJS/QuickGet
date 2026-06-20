export type RoutingMatchType = "url" | "magnet" | "torrent";

export type RoutingRule = {
  type?: RoutingMatchType;
  namePattern?: string;
  domain?: string;
  destination: string;
};

export type RoutingInput = {
  url: string;
  kind: RoutingMatchType;
};

export function classifyUrl(url: string): RoutingMatchType {
  if (url.startsWith("magnet:")) {
    return "magnet";
  }
  const cleanUrl = url.split("?")[0].split("#")[0];
  if (cleanUrl.endsWith(".torrent")) {
    return "torrent";
  }
  return "url";
}

export function resolveDestination(input: RoutingInput, rules: RoutingRule[], fallback: string): string {
  const filename = getFilename(input);
  const host = getHost(input.url);

  for (const rule of rules) {
    if (!rule.destination || rule.destination.trim() === "") {
      continue;
    }

    let matches = true;

    if (rule.type !== undefined) {
      if (rule.type !== input.kind) {
        matches = false;
      }
    }

    if (matches && rule.domain !== undefined) {
      if (!host || !matchDomain(host, rule.domain)) {
        matches = false;
      }
    }

    if (matches && rule.namePattern !== undefined) {
      if (!matchGlob(filename, rule.namePattern)) {
        matches = false;
      }
    }

    if (matches) {
      return rule.destination;
    }
  }

  return fallback;
}

function getFilename(input: RoutingInput): string {
  if (input.kind === "magnet") {
    try {
      const queryIndex = input.url.indexOf("?");
      if (queryIndex === -1) {
        return "";
      }
      const query = input.url.substring(queryIndex + 1);
      const params = query.split("&");
      for (const param of params) {
        const [key, val] = param.split("=");
        if (key === "dn" && val) {
          return decodeURIComponent(val.replace(/\+/g, "%20"));
        }
      }
      return "";
    } catch {
      return "";
    }
  }

  try {
    const cleanUrl = input.url.split("?")[0].split("#")[0];
    const urlObj = new URL(cleanUrl);
    const pathname = urlObj.pathname;
    const lastSegment = pathname.substring(pathname.lastIndexOf("/") + 1);
    return decodeURIComponent(lastSegment);
  } catch {
    const cleanUrl = input.url.split("?")[0].split("#")[0];
    const lastSegment = cleanUrl.substring(cleanUrl.lastIndexOf("/") + 1);
    return decodeURIComponent(lastSegment);
  }
}

function getHost(url: string): string | null {
  if (url.startsWith("magnet:")) {
    return null;
  }
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function matchDomain(host: string, pattern: string): boolean {
  const patternLower = pattern.toLowerCase();
  if (patternLower.startsWith("*.")) {
    const suffix = patternLower.substring(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return host === patternLower;
}

function matchGlob(filename: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regexStr = `^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`;
  const regex = new RegExp(regexStr, "i");
  return regex.test(filename);
}
