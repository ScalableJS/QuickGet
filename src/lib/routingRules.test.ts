import { describe, expect, it } from "vitest";

import {
  classifyUrl,
  matchGlob,
  normalizeDomain,
  resolveDestination,
  type RoutingRule,
  type RoutingRuleDraft,
  sanitizeRoutingRules,
  serializeRoutingRuleDraft,
  toRoutingRuleDraft,
  validateRoutingRuleDraft,
} from "./routingRules.js";

const FALLBACK = "Default";

function rule(rule: Partial<RoutingRule>): RoutingRule {
  return { destination: "Dest", ...rule };
}

describe("classifyUrl", () => {
  it.each([
    ["magnet:?xt=urn:btih:abc", "magnet"],
    ["MAGNET:?xt=urn:btih:abc", "magnet"],
    ["https://site.com/file.torrent", "torrent"],
    ["https://site.com/file.TORRENT", "torrent"],
    ["https://site.com/file.Torrent", "torrent"],
    ["https://site.com/file.torrent?x=1", "torrent"],
    ["https://site.com/video.mkv", "url"],
    ["http://site.com/", "url"],
  ] as const)("classifies %s as %s", (url, expected) => {
    expect(classifyUrl(url)).toBe(expected);
  });
});

describe("normalizeDomain", () => {
  it("strips http/https protocol", () => {
    expect(normalizeDomain("https://example.com")).toBe("example.com");
    expect(normalizeDomain("http://sub.example.com")).toBe("sub.example.com");
  });

  it("strips trailing slashes and paths", () => {
    expect(normalizeDomain("example.com/")).toBe("example.com");
    expect(normalizeDomain("example.com/path/to/page")).toBe("example.com");
  });

  it("strips trailing dots", () => {
    expect(normalizeDomain("example.com.")).toBe("example.com");
    expect(normalizeDomain("example.com...")).toBe("example.com");
  });

  it("lowercases and trims whitespace", () => {
    expect(normalizeDomain("  TRACKER.Example.Com  ")).toBe("tracker.example.com");
  });
});

describe("matchGlob", () => {
  it("matches standard wildcards case-insensitively", () => {
    expect(matchGlob("Movie.MKV", "*.mkv")).toBe(true);
    expect(matchGlob("The_Director_Cut_Final.mkv", "*Director_Cut*")).toBe(true);
    expect(matchGlob("episode_01.mp4", "*_??.mp4")).toBe(true);
    expect(matchGlob("episode_001.mp4", "*_??.mp4")).toBe(false);
  });

  it("handles filenames containing regex metacharacters literally", () => {
    expect(matchGlob("[Group] Anime (2024) + OVA.mkv", "*[Group] Anime (2024) + OVA*")).toBe(true);
    expect(matchGlob("{tag} file $100^.torrent", "*{tag} file $100^*")).toBe(true);
    expect(matchGlob("file.part(1).rar", "*.part(1).*")).toBe(true);
  });

  it("is completely immune to catastrophic backtracking (ReDoS)", () => {
    const start = performance.now();
    // Pathological pattern that causes exponential backtracking with RegExp (.*a.*a.*a...b)
    const pattern = "*a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*b";
    const input = "a".repeat(40);
    const matched = matchGlob(input, pattern);
    const duration = performance.now() - start;

    expect(matched).toBe(false);
    expect(duration).toBeLessThan(50); // Linear matcher executes in <5ms
  });
});

describe("sanitizeRoutingRules", () => {
  it("drops whitespace-only destinations", () => {
    expect(sanitizeRoutingRules([{ destination: "   " }])).toEqual([]);
  });

  it("drops rules without conditions (prevents dangerous catch-all shadow rules)", () => {
    expect(sanitizeRoutingRules([{ destination: "CatchAll" }])).toEqual([]);
    expect(sanitizeRoutingRules([{ destination: "CatchAll", domain: "   ", namePattern: "" }])).toEqual([]);
    expect(sanitizeRoutingRules([{ destination: "InvalidType", type: "not-a-type" }])).toEqual([]);
  });

  it("strips domain from magnet rule even if no other pattern is specified", () => {
    expect(sanitizeRoutingRules([{ type: "magnet", domain: "tracker.com", destination: "Magnets" }])).toEqual([
      { type: "magnet", destination: "Magnets" },
    ]);
  });

  it("strips domain from magnet rules while retaining valid conditions", () => {
    const input = [
      {
        type: "magnet",
        domain: "tracker.com",
        namePattern: "*ubuntu*",
        destination: "Magnets",
      },
    ];
    expect(sanitizeRoutingRules(input)).toEqual([
      {
        type: "magnet",
        namePattern: "*ubuntu*",
        destination: "Magnets",
      },
    ]);
  });

  it("normalizes domains and strips empty condition strings", () => {
    const input = [
      {
        destination: "Movies",
        domain: "https://Tracker.ORG/ ",
        namePattern: "",
      },
    ];
    const sanitized = sanitizeRoutingRules(input);
    expect(sanitized).toEqual([
      {
        destination: "Movies",
        domain: "tracker.org",
      },
    ]);
  });

  it("drops non-array or malformed data", () => {
    expect(sanitizeRoutingRules(null)).toEqual([]);
    expect(sanitizeRoutingRules("not an array")).toEqual([]);
    expect(sanitizeRoutingRules([{ noDestination: true }])).toEqual([]);
  });
});

describe("RoutingRuleDraft helpers", () => {
  it("toRoutingRuleDraft guarantees concrete string values and defaults type to 'all'", () => {
    const storedRule: RoutingRule = {
      destination: "Movies",
      type: "torrent",
    };
    const draft = toRoutingRuleDraft(storedRule, "fixed-id");
    expect(draft).toEqual({
      id: "fixed-id",
      type: "torrent",
      namePattern: "",
      domain: "",
      destination: "Movies",
    });

    const ruleWithoutType: RoutingRule = {
      destination: "General",
      namePattern: "*.zip",
    };
    expect(toRoutingRuleDraft(ruleWithoutType, "id-2").type).toBe("all");
  });

  it("validateRoutingRuleDraft checks required destination and conditions", () => {
    const emptyDraft: RoutingRuleDraft = {
      id: "1",
      type: "all",
      destination: "",
      namePattern: "",
      domain: "",
    };
    const res1 = validateRoutingRuleDraft(emptyDraft);
    expect(res1.valid).toBe(false);
    expect(res1.errors.destination).toBeDefined();
    expect(res1.errors.conditions).toBeDefined();

    const noConditionDraft: RoutingRuleDraft = {
      id: "2",
      type: "all",
      destination: "Movies",
      namePattern: "",
      domain: "",
    };
    const res2 = validateRoutingRuleDraft(noConditionDraft);
    expect(res2.valid).toBe(false);
    expect(res2.errors.destination).toBeUndefined();
    expect(res2.errors.conditions).toBeDefined();

    const typeOnlyDraft: RoutingRuleDraft = {
      id: "3",
      type: "torrent",
      destination: "Torrents",
      namePattern: "",
      domain: "",
    };
    const res3 = validateRoutingRuleDraft(typeOnlyDraft);
    expect(res3.valid).toBe(true);

    const validDraft: RoutingRuleDraft = {
      id: "4",
      type: "all",
      destination: "Movies",
      namePattern: "*.mkv",
      domain: "",
    };
    const res4 = validateRoutingRuleDraft(validDraft);
    expect(res4.valid).toBe(true);
    expect(res4.errors.destination).toBeUndefined();
    expect(res4.errors.conditions).toBeUndefined();
  });

  it("serializeRoutingRuleDraft produces clean storage rule and omits magnet domain and 'all' type", () => {
    const draft: RoutingRuleDraft = {
      id: "1",
      type: "magnet",
      namePattern: "*movie*",
      domain: "should-be-omitted.com",
      destination: "Torrents/Magnets",
    };
    const serialized = serializeRoutingRuleDraft(draft);
    expect(serialized).toEqual({
      destination: "Torrents/Magnets",
      type: "magnet",
      namePattern: "*movie*",
    });

    const anyTypeDraft: RoutingRuleDraft = {
      id: "2",
      type: "all",
      namePattern: "*.iso",
      domain: "",
      destination: "Images",
    };
    expect(serializeRoutingRuleDraft(anyTypeDraft)).toEqual({
      destination: "Images",
      namePattern: "*.iso",
    });
  });
});

describe("resolveDestination", () => {
  it("returns the fallback when there are no rules", () => {
    expect(resolveDestination({ url: "https://x.com/a.mkv", kind: "url" }, [], FALLBACK)).toBe(FALLBACK);
  });

  it("returns the fallback when no rule matches", () => {
    const rules = [rule({ namePattern: "*.mp4", destination: "Clips" })];
    expect(resolveDestination({ url: "https://x.com/a.mkv", kind: "url" }, rules, FALLBACK)).toBe(FALLBACK);
  });

  it("matches a filename glob (case-insensitive)", () => {
    const rules = [rule({ namePattern: "*.MKV", destination: "Movies" })];
    expect(resolveDestination({ url: "https://x.com/path/Show.mkv", kind: "url" }, rules, FALLBACK)).toBe("Movies");
  });

  it("does not match a glob for a different extension", () => {
    const rules = [rule({ namePattern: "*.mkv", destination: "Movies" })];
    expect(resolveDestination({ url: "https://x.com/song.mp3", kind: "url" }, rules, FALLBACK)).toBe(FALLBACK);
  });

  it("supports a substring glob like *2024*", () => {
    const rules = [rule({ namePattern: "*2024*", destination: "NewReleases" })];
    expect(resolveDestination({ url: "https://x.com/Movie.2024.1080p.mkv", kind: "url" }, rules, FALLBACK)).toBe(
      "NewReleases",
    );
  });

  it("ignores the query string when reading the filename", () => {
    const rules = [rule({ namePattern: "*.mkv", destination: "Movies" })];
    expect(resolveDestination({ url: "https://x.com/a/b.mkv?token=xyz", kind: "url" }, rules, FALLBACK)).toBe("Movies");
  });

  it("matches a magnet display name via dn=", () => {
    const rules = [rule({ namePattern: "*flac*", destination: "Lossless" })];
    const magnet = "magnet:?xt=urn:btih:abc&dn=Album%20%5BFLAC%5D";
    expect(resolveDestination({ url: magnet, kind: "magnet" }, rules, FALLBACK)).toBe("Lossless");
  });

  it("correctly parses magnet dn with '=' inside filename", () => {
    const rules = [rule({ namePattern: "*Part1*", destination: "Matched" })];
    const magnet = "magnet:?xt=urn:btih:abc&dn=Movie=Part1.mkv";
    expect(resolveDestination({ url: magnet, kind: "magnet" }, rules, FALLBACK)).toBe("Matched");
  });

  it("handles malformed percent encoding safely without throwing URIError", () => {
    const rules = [rule({ namePattern: "*foo*", destination: "Movies" })];
    expect(
      resolveDestination({ url: "https://example.com/foo%ZZ.mkv", kind: "url" }, rules, FALLBACK),
    ).toBe("Movies");
  });

  it("matches an exact domain", () => {
    const rules = [rule({ domain: "releases.example.com", destination: "Site" })];
    expect(resolveDestination({ url: "https://releases.example.com/f.zip", kind: "url" }, rules, FALLBACK)).toBe(
      "Site",
    );
  });

  it("matches a domain even when configured with protocol, slash, or trailing dot", () => {
    const rules = [rule({ domain: "https://releases.example.com/", destination: "Site" })];
    expect(resolveDestination({ url: "https://releases.example.com/f.zip", kind: "url" }, rules, FALLBACK)).toBe(
      "Site",
    );
  });

  it("matches a wildcard domain against subdomains and the apex", () => {
    const rules = [rule({ domain: "*.example.com", destination: "Site" })];
    expect(resolveDestination({ url: "https://dl.example.com/f.zip", kind: "url" }, rules, FALLBACK)).toBe("Site");
    expect(resolveDestination({ url: "https://example.com/f.zip", kind: "url" }, rules, FALLBACK)).toBe("Site");
  });

  it("does not match an unrelated domain", () => {
    const rules = [rule({ domain: "*.example.com", destination: "Site" })];
    expect(resolveDestination({ url: "https://example.org/f.zip", kind: "url" }, rules, FALLBACK)).toBe(FALLBACK);
  });

  it("matches by link kind", () => {
    const rules = [rule({ type: "magnet", destination: "Torrents" })];
    expect(resolveDestination({ url: "magnet:?xt=urn:btih:abc", kind: "magnet" }, rules, FALLBACK)).toBe("Torrents");
    expect(resolveDestination({ url: "https://x.com/a.mkv", kind: "url" }, rules, FALLBACK)).toBe(FALLBACK);
  });

  it("requires ALL conditions on a rule to match (AND)", () => {
    const rules = [rule({ type: "url", domain: "*.example.com", namePattern: "*.mkv", destination: "Match" })];
    expect(resolveDestination({ url: "https://dl.example.com/x.mkv", kind: "url" }, rules, FALLBACK)).toBe("Match");
    // right domain, wrong extension → no match
    expect(resolveDestination({ url: "https://dl.example.com/x.mp4", kind: "url" }, rules, FALLBACK)).toBe(FALLBACK);
  });

  it("returns the first matching rule's destination", () => {
    const rules = [
      rule({ namePattern: "*.mkv", destination: "First" }),
      rule({ namePattern: "*.mkv", destination: "Second" }),
    ];
    expect(resolveDestination({ url: "https://x.com/a.mkv", kind: "url" }, rules, FALLBACK)).toBe("First");
  });

  it("treats a rule with an empty destination as incomplete (skipped)", () => {
    const rules = [
      rule({ namePattern: "*.mkv", destination: "" }),
      rule({ namePattern: "*.mkv", destination: "Movies" }),
    ];
    expect(resolveDestination({ url: "https://x.com/a.mkv", kind: "url" }, rules, FALLBACK)).toBe("Movies");
  });
});
