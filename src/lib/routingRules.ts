import type { SourceKind } from "./sourceKind.js";

export type RoutingRuleDraftType = "all" | SourceKind;

export type RoutingRule = {
  type?: SourceKind;
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
  kind: SourceKind;
  /**
   * The page the download started from, when there is one — the tab a link was clicked in, or
   * the referrer Chrome recorded. A domain rule matches this as well as the file's own host: a
   * magnet has no host at all, and a tracker that serves its torrents from a mirror would
   * otherwise defeat a rule written for the tracker.
   */
  pageUrl?: string;
  /**
   * The name the download will actually have, when the caller knows it.
   *
   * Deriving a name from the URL is a last resort: for a `.torrent` it yields the metadata
   * file (`1234.torrent`), not the release inside, and a rule written as `*.mkv` then matches
   * nothing. Callers that hold something better — the `.torrent`'s own `info.name`, or the
   * filename Chrome derived from `Content-Disposition` — pass it here.
   */
  name?: string;
};

export type RoutingRuleValidationResult = {
  valid: boolean;
  errors: {
    destination?: string;
    conditions?: string;
  };
};

const MATCH_TYPES: readonly SourceKind[] = ["url", "magnet", "torrent"];

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
  const hasCondition = draft.type !== "all" || draft.domain.trim().length > 0 || draft.namePattern.trim().length > 0;

  return {
    valid: hasDestination && hasCondition,
    errors: {
      destination: hasDestination ? undefined : "Destination folder is required",
      conditions: hasCondition ? undefined : "Set at least one condition: source, name or extension, or site",
    },
  };
}

/**
 * Turn an editor draft into a stored rule, or `null` when it is not a rule yet.
 *
 * Trimming, domain normalisation and "a magnet has no domain" are not restated here: the
 * sanitizer is the one place that knows what a valid stored rule looks like, and a second copy
 * of those decisions is how the editor and storage drifted apart in the first place.
 */
export function serializeRoutingRuleDraft(draft: RoutingRuleDraft): RoutingRule | null {
  if (!validateRoutingRuleDraft(draft).valid) return null;

  const [rule] = sanitizeRoutingRules([
    {
      destination: draft.destination,
      type: draft.type === "all" ? undefined : draft.type,
      namePattern: draft.namePattern,
      domain: draft.domain,
    },
  ]);
  return rule ?? null;
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
 *
 * A domain used to be stripped from magnet rules, on the reasoning that a magnet has no host.
 * It has no host *of its own* — but it was clicked on a page, and that page is what a user means
 * by "where I download from". The domain now matches the origin, so magnet rules keep theirs.
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
      rule.type = candidate.type as SourceKind;
    }
    if (typeof candidate.namePattern === "string") {
      const patterns = listValues(candidate.namePattern);
      if (patterns.length > 0) rule.namePattern = patterns.join(" ");
    }
    if (typeof candidate.domain === "string") {
      const domains = listValues(candidate.domain).map(normalizeDomain).filter(Boolean);
      if (domains.length > 0) rule.domain = domains.join(" ");
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

/**
 * The folder a download should land in, or `fallback` when no rule claims it.
 *
 * **Rules must already be sanitized** — `sanitizeRoutingRules` runs at both boundaries they can
 * arrive through, `loadSettings` and backup import. So every rule here has a non-empty
 * destination, a normalised domain and a non-empty pattern, and the matcher does not re-check
 * any of it. Re-trimming here was a second, silent copy of the storage contract.
 */
export function resolveDestination(input: RoutingInput, rules: RoutingRule[], fallback: string): string {
  const name = nameOf(input);
  const hosts = originHosts(input);

  for (const rule of rules) {
    const { type, domain, namePattern } = rule;
    if (type !== undefined && type !== input.kind) continue;
    if (domain !== undefined && !matchesAnyDomain(hosts, domain)) continue;
    if (namePattern !== undefined && !matchesName(name, namePattern)) continue;
    return rule.destination;
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

/**
 * What the rule's pattern is compared against.
 *
 * The caller supplies it whenever it knows better than the URL does — the `.torrent`'s own
 * `info.name`, a magnet's display name, the filename Chrome derived from `Content-Disposition`.
 * The path-segment fallback is for an ordinary link, where the URL genuinely is the name; the
 * router deliberately knows nothing about how any particular source format spells its name.
 */
function nameOf(input: RoutingInput): string {
  const known = input.name?.trim();
  if (known) return known;

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

/**
 * Split a condition field into the values it lists, on spaces or commas or both.
 *
 * One rule per extension is the thing that made the editor an intake form: "video" meant eight
 * rules with eight folder pickers. A field holds a list, values are OR-ed inside a field, and the
 * fields are still AND-ed with each other.
 */
function listValues(field: string): string[] {
  return field.split(/[\s,]+/).filter(Boolean);
}

function matchesName(name: string, patterns: string): boolean {
  return listValues(patterns).some((token) => matchNameToken(name, token));
}

/**
 * A token containing a wildcard is a glob; anything else is an extension, so `mkv`, `.mkv` and
 * `*.mkv` all mean the same thing. Deliberately not "extension or substring" — that would make
 * `mp4` quietly match `mp4converter.zip`, and a rule you cannot predict is worse than one you
 * have to spell out. Substring matching is what `*` is for.
 */
function matchNameToken(name: string, token: string): boolean {
  if (token.includes("*") || token.includes("?")) return matchGlob(name, token);
  const extension = token.startsWith(".") ? token : `.${token}`;
  return name.toLowerCase().endsWith(extension.toLowerCase());
}

function matchesAnyDomain(hosts: string[], domains: string): boolean {
  return listValues(domains).some((pattern) => hosts.some((host) => matchDomain(host, pattern)));
}

/** Every host a domain rule may legitimately match: the file's own, and the page it came from. */
function originHosts(input: RoutingInput): string[] {
  const hosts = [hostOf(input.url), hostOf(input.pageUrl)].filter((host): host is string => host !== null);
  return [...new Set(hosts)];
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    // A magnet parses but has no authority, so its hostname is the empty string.
    return hostname || null;
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
