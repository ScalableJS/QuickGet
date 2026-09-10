import { describe, expect, it } from "vitest";
import {
  matchGlob,
  normalizeDomain,
  type RoutingRule,
  type RoutingRuleDraft,
  resolveDestination,
  sanitizeRoutingRules,
  serializeRoutingRuleDraft,
  toRoutingRuleDraft,
  validateRoutingRuleDraft,
} from "./routingRules.js";
import { magnetDisplayName } from "./sourceKind.js";

const FALLBACK = "Default";

function rule(rule: Partial<RoutingRule>): RoutingRule {
  return { destination: "Dest", ...rule };
}

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

  /**
   * A magnet's domain used to be stripped here, because a magnet has no host. It has no host *of
   * its own* — but it was clicked on a page, and that page is what "where I download from" means.
   */
  it("keeps the domain on a magnet rule, which now matches the page it was clicked on", () => {
    expect(sanitizeRoutingRules([{ type: "magnet", domain: "tracker.com", destination: "Magnets" }])).toEqual([
      { type: "magnet", domain: "tracker.com", destination: "Magnets" },
    ]);

    expect(
      sanitizeRoutingRules([
        { type: "magnet", domain: "tracker.com", namePattern: "*ubuntu*", destination: "Magnets" },
      ]),
    ).toEqual([{ type: "magnet", domain: "tracker.com", namePattern: "*ubuntu*", destination: "Magnets" }]);
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

  it("serializeRoutingRuleDraft produces a clean storage rule and omits the 'all' type", () => {
    const draft: RoutingRuleDraft = {
      id: "1",
      type: "magnet",
      namePattern: "*movie*",
      domain: "Tracker.COM/",
      destination: "Torrents/Magnets",
    };
    const serialized = serializeRoutingRuleDraft(draft);
    expect(serialized).toEqual({
      destination: "Torrents/Magnets",
      type: "magnet",
      namePattern: "*movie*",
      domain: "tracker.com",
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

  /**
   * Reading `dn` out of a magnet is the caller's job (`magnetDisplayName`, covered in
   * `sourceKind.test.ts`); the router only matches what it is handed. It used to parse the URI
   * itself, which meant the matcher had to know one source format and not the others.
   */
  it("matches a magnet on the display name its caller supplies", () => {
    const rules = [rule({ namePattern: "*flac*", destination: "Lossless" })];
    const magnet = "magnet:?xt=urn:btih:abc&dn=Album%20%5BFLAC%5D";
    expect(resolveDestination({ url: magnet, kind: "magnet", name: magnetDisplayName(magnet) }, rules, FALLBACK)).toBe(
      "Lossless",
    );
  });

  it("leaves a magnet with no display name to its type and domain rules", () => {
    const rules = [rule({ namePattern: "*", destination: "Anything" })];
    const magnet = "magnet:?xt=urn:btih:abc";
    expect(resolveDestination({ url: magnet, kind: "magnet", name: magnetDisplayName(magnet) }, rules, FALLBACK)).toBe(
      "Anything",
    );
  });

  it("handles malformed percent encoding safely without throwing URIError", () => {
    const rules = [rule({ namePattern: "*foo*", destination: "Movies" })];
    expect(resolveDestination({ url: "https://example.com/foo%ZZ.mkv", kind: "url" }, rules, FALLBACK)).toBe("Movies");
  });

  it("matches an exact domain", () => {
    const rules = [rule({ domain: "releases.example.com", destination: "Site" })];
    expect(resolveDestination({ url: "https://releases.example.com/f.zip", kind: "url" }, rules, FALLBACK)).toBe(
      "Site",
    );
  });

  it("matches a domain written with protocol, slash or trailing dot — normalised on the way in", () => {
    const rules = sanitizeRoutingRules([{ domain: "https://releases.example.com/", destination: "Site" }]);
    expect(resolveDestination({ url: "https://releases.example.com/f.zip", kind: "url" }, rules, FALLBACK)).toBe(
      "Site",
    );
  });

  /**
   * A magnet has no host, and a tracker that serves its torrents from a mirror has the wrong one.
   * The page the download started from is the host a user means by "where I download from".
   */
  it("matches a domain rule against the originating page as well as the file", () => {
    const rules = [rule({ domain: "tracker.example.com", destination: "FromTracker" })];

    expect(
      resolveDestination(
        { url: "magnet:?xt=urn:btih:abc", kind: "magnet", pageUrl: "https://tracker.example.com/topic/1" },
        rules,
        FALLBACK,
      ),
    ).toBe("FromTracker");

    expect(
      resolveDestination(
        { url: "https://cdn.mirror.net/f.torrent", kind: "torrent", pageUrl: "https://tracker.example.com/topic/1" },
        rules,
        FALLBACK,
      ),
    ).toBe("FromTracker");

    expect(resolveDestination({ url: "https://cdn.mirror.net/f.torrent", kind: "torrent" }, rules, FALLBACK)).toBe(
      FALLBACK,
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

  it("takes its rules already sanitized — the sanitizer drops incomplete ones, not the matcher", () => {
    const stored = [
      { namePattern: "*.mkv", destination: "   " },
      { namePattern: "  *.mkv  ", destination: "Movies" },
    ];
    expect(
      resolveDestination({ url: "https://x.com/a.mkv", kind: "url" }, sanitizeRoutingRules(stored), FALLBACK),
    ).toBe("Movies");
  });
});

/**
 * The name a rule matches against is the whole point of the feature, and the URL is the worst
 * available source for it: a `.torrent` link names the metadata file, and an opaque tracker
 * endpoint names nothing at all. Callers that know better say so.
 */
describe("resolveDestination — explicit name", () => {
  const rules: RoutingRule[] = [{ namePattern: "*.mkv", destination: "Multimedia/Movies" }];

  it("matches the supplied name instead of the URL when one is given", () => {
    const input = { url: "https://tracker.example.com/dl.php?id=12345", kind: "torrent" as const };

    expect(resolveDestination(input, rules, "Download")).toBe("Download");
    expect(resolveDestination({ ...input, name: "Some.Movie.2024.mkv" }, rules, "Download")).toBe("Multimedia/Movies");
  });

  it("prefers the supplied name over the .torrent file name in the URL", () => {
    const input = {
      url: "https://files.example.com/1234.torrent",
      kind: "torrent" as const,
      name: "Some.Movie.2024.mkv",
    };

    expect(resolveDestination(input, rules, "Download")).toBe("Multimedia/Movies");
  });

  it("overrides a magnet's dn when the real release name becomes known", () => {
    const input = {
      url: "magnet:?xt=urn:btih:abc&dn=placeholder",
      kind: "magnet" as const,
      name: "Some.Movie.2024.mkv",
    };

    expect(resolveDestination(input, rules, "Download")).toBe("Multimedia/Movies");
  });

  it("falls back to the URL when the supplied name is blank", () => {
    const input = { url: "https://files.example.com/Some.Movie.2024.mkv", kind: "url" as const, name: "   " };

    expect(resolveDestination(input, rules, "Download")).toBe("Multimedia/Movies");
  });
});

/**
 * One rule per extension was the thing that made routing feel like an intake form. A field holds
 * a list; the values are OR-ed inside the field and the fields stay AND-ed with each other.
 */
describe("resolveDestination — lists in one field", () => {
  const FALLBACK_HERE = "Download";

  it("matches any of several extensions written the way people write them", () => {
    const [videoRule] = sanitizeRoutingRules([{ namePattern: "mkv, .mp4  *.avi", destination: "Movies" }]);

    for (const name of ["Some.Movie.mkv", "Clip.MP4", "Old.avi"]) {
      expect(resolveDestination({ url: "https://x.com/f", kind: "url", name }, [videoRule], FALLBACK_HERE)).toBe(
        "Movies",
      );
    }
    expect(
      resolveDestination({ url: "https://x.com/f", kind: "url", name: "notes.pdf" }, [videoRule], FALLBACK_HERE),
    ).toBe(FALLBACK_HERE);
  });

  it("treats a bare token as an extension, not as a substring", () => {
    const [rule] = sanitizeRoutingRules([{ namePattern: "mp4", destination: "Movies" }]);

    expect(
      resolveDestination({ url: "https://x.com/f", kind: "url", name: "mp4converter.zip" }, [rule], FALLBACK_HERE),
    ).toBe(FALLBACK_HERE);
    expect(
      resolveDestination({ url: "https://x.com/f", kind: "url", name: "holiday.mp4" }, [rule], FALLBACK_HERE),
    ).toBe("Movies");
  });

  it("still supports globs for everything an extension cannot express", () => {
    const [rule] = sanitizeRoutingRules([{ namePattern: "*S0?E0?* *1080p*", destination: "Series" }]);

    expect(
      resolveDestination(
        { url: "https://x.com/f", kind: "torrent", name: "Some.Show.S01E02.WEB-DL" },
        [rule],
        FALLBACK_HERE,
      ),
    ).toBe("Series");
    expect(
      resolveDestination(
        { url: "https://x.com/f", kind: "torrent", name: "Some.Show.S01.1080p.WEB-DL" },
        [rule],
        FALLBACK_HERE,
      ),
    ).toBe("Series");
  });

  it("matches any of several domains, each normalised on the way in", () => {
    const [rule] = sanitizeRoutingRules([{ domain: "https://rutracker.org/, *.nnmclub.to", destination: "Trackers" }]);
    expect(rule.domain).toBe("rutracker.org *.nnmclub.to");

    for (const url of ["https://rutracker.org/f.torrent", "https://dl.nnmclub.to/f.torrent"]) {
      expect(resolveDestination({ url, kind: "torrent" }, [rule], FALLBACK_HERE)).toBe("Trackers");
    }
    expect(resolveDestination({ url: "https://other.example/f.torrent", kind: "torrent" }, [rule], FALLBACK_HERE)).toBe(
      FALLBACK_HERE,
    );
  });

  it("keeps fields AND-ed while values inside a field are OR-ed", () => {
    const [rule] = sanitizeRoutingRules([
      { namePattern: "mkv mp4", domain: "rutracker.org nnmclub.to", destination: "TrackerVideo" },
    ]);

    expect(
      resolveDestination({ url: "https://rutracker.org/f", kind: "torrent", name: "a.mkv" }, [rule], FALLBACK_HERE),
    ).toBe("TrackerVideo");
    // Right domain, wrong kind of file.
    expect(
      resolveDestination({ url: "https://rutracker.org/f", kind: "torrent", name: "a.pdf" }, [rule], FALLBACK_HERE),
    ).toBe(FALLBACK_HERE);
    // Right file, wrong site.
    expect(
      resolveDestination({ url: "https://other.example/f", kind: "torrent", name: "a.mkv" }, [rule], FALLBACK_HERE),
    ).toBe(FALLBACK_HERE);
  });
});
