export type RoutingMatchType = "url" | "magnet" | "torrent";
export type RoutingRuleDraftType = "all" | RoutingMatchType;

export type RoutingRule = {
  type?: RoutingMatchType;
  namePattern?: string;
  domain?: string;
  destination: string;
};

export type RoutingRuleDraft = {
  id: string;
  type: RoutingRuleDraftType;
  namePattern: string;
  domain: string;
  destination: string;
};

export type RoutingInput = {
  url: string;
  kind: RoutingMatchType;
};

export type RoutingRuleValidationResult = {
  valid: boolean;
  errors: {
    destination?: string;
    conditions?: string;
  };
};

const MATCH_TYPES: readonly RoutingMatchType[] = ["url", "magnet", "torrent"];

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function toRoutingRuleDraft(rule: RoutingRule, id?: string): RoutingRuleDraft {
  return {
    id: id ?? generateId(),
    type: rule.type ?? "all",
    namePattern: rule.namePattern ?? "",
    domain: rule.domain ?? "",
    destination: rule.destination ?? "",
  };
}

export function validateRoutingRuleDraft(draft: RoutingRuleDraft): RoutingRuleValidationResult {
  const hasDestination = draft.destination.trim().length > 0;
  const hasCondition =
    draft.type !== "all" || draft.domain.trim().length > 0 || draft.namePattern.trim().length > 0;

  return {
    valid: hasDestination && hasCondition,
    errors: {
      destination: hasDestination ? undefined : "Destination folder is required",
      conditions: hasCondition ? undefined : "Specify at least one condition (type, domain, or filename pattern)",
    },
  };
}

export function serializeRoutingRuleDraft(draft: RoutingRuleDraft): RoutingRule | null {
  const validation = validateRoutingRuleDraft(draft);
  if (!validation.valid) return null;

  const rule: RoutingRule = {
    destination: draft.destination.trim(),
  };
  if (draft.type && draft.type !== "all") {
    rule.type = draft.type;
  }
  if (draft.namePattern.trim()) {
    rule.namePattern = draft.namePattern.trim();
  }
  if (draft.type !== "magnet" && draft.domain.trim()) {
    rule.domain = normalizeDomain(draft.domain.trim());
  }
  return rule;
}

export function normalizeDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//i, "");
  d = d.replace(/\/.*$/, "");
  d = d.replace(/\.+$/, "");
  return d;
}

/**
 * Validate untrusted routing-rule data (from storage or an imported backup),
 * dropping any malformed or condition-less entry.
 *
 * Invariant: A valid rule MUST have:
 * 1. A non-whitespace `destination`
 * 2. At least one active condition (type, domain, or namePattern).
 *    Catch-all rules without conditions are prohibited (unmatched downloads use global Target folder).
 * 3. Domain is inapplicable to `magnet` and is stripped if present.
 */
export function sanitizeRoutingRules(raw: unknown): RoutingRule[] {
  if (!Array.isArray(raw)) return [];
  const rules: RoutingRule[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.destination !== "string") continue;
    const destination = candidate.destination.trim();
    if (destination === "") continue;

    const rule: RoutingRule = { destination };
    if (typeof candidate.type === "string" && (MATCH_TYPES as string[]).includes(candidate.type)) {
      rule.type = candidate.type as RoutingMatchType;
    }
    if (typeof candidate.namePattern === "string" && candidate.namePattern.trim() !== "") {
      rule.namePattern = candidate.namePattern.trim();
    }
    // Domain is only applicable when type is not "magnet"
    if (rule.type !== "magnet" && typeof candidate.domain === "string") {
      const normalized = normalizeDomain(candidate.domain);
      if (normalized !== "") {
        rule.domain = normalized;
      }
    }

    // Must have at least one active condition to avoid becoming a dangerous catch-all
    const hasCondition = Boolean(rule.type) || Boolean(rule.domain) || Boolean(rule.namePattern);
    if (!hasCondition) continue;

    rules.push(rule);
  }
  return rules;
}

/** Drop the query string and fragment, leaving just scheme + host + path. */
function stripQueryAndHash(url: string): string {
  return url.split("?")[0].split("#")[0];
}

export function classifyUrl(url: string): RoutingMatchType {
  const trimmed = url.trim();
  if (/^magnet:/i.test(trimmed)) {
    return "magnet";
  }
  if (stripQueryAndHash(trimmed).toLowerCase().endsWith(".torrent")) {
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
    if (
      rule.domain !== undefined &&
      rule.domain.trim() !== "" &&
      (!host || !matchDomain(host, normalizeDomain(rule.domain)))
    ) {
      continue;
    }
    if (
      rule.namePattern !== undefined &&
      rule.namePattern.trim() !== "" &&
      !matchGlob(filename, rule.namePattern)
    ) {
      continue;
    }
    return rule.destination.trim();
  }

  return fallback;
}

function safeDecodeURIComponent(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

function getFilename(input: RoutingInput): string {
  if (input.kind === "magnet") {
    try {
      const queryIndex = input.url.indexOf("?");
      if (queryIndex === -1) {
        return "";
      }
      const query = input.url.substring(queryIndex + 1);
      const params = new URLSearchParams(query);
      return params.get("dn") ?? "";
    } catch {
      return "";
    }
  }

  const cleanUrl = stripQueryAndHash(input.url);
  try {
    const pathname = new URL(cleanUrl).pathname;
    const lastSegment = pathname.substring(pathname.lastIndexOf("/") + 1);
    return safeDecodeURIComponent(lastSegment);
  } catch {
    const lastSegment = cleanUrl.substring(cleanUrl.lastIndexOf("/") + 1);
    return safeDecodeURIComponent(lastSegment);
  }
}

function getHost(url: string): string | null {
  if (/^magnet:/i.test(url.trim())) {
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

/**
 * Linear-time wildcard matcher supporting `*` (zero or more characters) and `?` (any single character).
 * Case-insensitive. Completely immune to RegExp ReDoS / catastrophic backtracking.
 * Treats all other characters (including regex metacharacters `[]()+${}^`) as exact literals.
 */
export function matchGlob(filename: string, pattern: string): boolean {
  const s = filename.toLowerCase();
  const p = pattern.toLowerCase();

  let sIdx = 0;
  let pIdx = 0;
  let starIdx = -1;
  let sTmpIdx = -1;

  while (sIdx < s.length) {
    if (pIdx < p.length && (p[pIdx] === "?" || p[pIdx] === s[sIdx])) {
      sIdx++;
      pIdx++;
    } else if (pIdx < p.length && p[pIdx] === "*") {
      starIdx = pIdx;
      sTmpIdx = sIdx;
      pIdx++;
    } else if (starIdx !== -1) {
      pIdx = starIdx + 1;
      sTmpIdx++;
      sIdx = sTmpIdx;
    } else {
      return false;
    }
  }

  while (pIdx < p.length && p[pIdx] === "*") {
    pIdx++;
  }

  return pIdx === p.length;
}
