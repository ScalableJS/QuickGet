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

const MATCH_TYPES: readonly RoutingMatchType[] = ["url", "magnet", "torrent"];

/**
 * Validate untrusted routing-rule data (from storage or an imported backup),
 * dropping any malformed entry. A rule must have a string `destination`; `type`,
 * `namePattern` and `domain` are kept only when present and well-typed.
 */
export function sanitizeRoutingRules(raw: unknown): RoutingRule[] {
  if (!Array.isArray(raw)) return [];
  const rules: RoutingRule[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.destination !== "string") continue;
    const rule: RoutingRule = { destination: candidate.destination };
    if (typeof candidate.type === "string" && (MATCH_TYPES as string[]).includes(candidate.type)) {
      rule.type = candidate.type as RoutingMatchType;
    }
    if (typeof candidate.namePattern === "string") rule.namePattern = candidate.namePattern;
    if (typeof candidate.domain === "string") rule.domain = candidate.domain;
    rules.push(rule);
  }
  return rules;
}

/** Drop the query string and fragment, leaving just scheme + host + path. */
function stripQueryAndHash(url: string): string {
  return url.split("?")[0].split("#")[0];
}

export function classifyUrl(url: string): RoutingMatchType {
  if (url.startsWith("magnet:")) {
    return "magnet";
  }
  if (stripQueryAndHash(url).endsWith(".torrent")) {
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
    if (rule.type !== undefined && rule.type !== input.kind) {
      continue;
    }
    if (rule.domain !== undefined && (!host || !matchDomain(host, rule.domain))) {
      continue;
    }
    if (rule.namePattern !== undefined && !matchGlob(filename, rule.namePattern)) {
      continue;
    }
    return rule.destination;
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

  const cleanUrl = stripQueryAndHash(input.url);
  try {
    const pathname = new URL(cleanUrl).pathname;
    const lastSegment = pathname.substring(pathname.lastIndexOf("/") + 1);
    return decodeURIComponent(lastSegment);
  } catch {
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
