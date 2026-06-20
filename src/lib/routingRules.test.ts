import { describe, expect, it } from "vitest";

import { classifyUrl, type RoutingRule, resolveDestination } from "./routingRules.js";

const FALLBACK = "Default";

function rule(rule: Partial<RoutingRule>): RoutingRule {
  return { destination: "Dest", ...rule };
}

describe("classifyUrl", () => {
  it.each([
    ["magnet:?xt=urn:btih:abc", "magnet"],
    ["https://site.com/file.torrent", "torrent"],
    ["https://site.com/file.torrent?x=1", "torrent"],
    ["https://site.com/video.mkv", "url"],
    ["http://site.com/", "url"],
  ] as const)("classifies %s as %s", (url, expected) => {
    expect(classifyUrl(url)).toBe(expected);
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

  it("matches an exact domain", () => {
    const rules = [rule({ domain: "releases.example.com", destination: "Site" })];
    expect(resolveDestination({ url: "https://releases.example.com/f.zip", kind: "url" }, rules, FALLBACK)).toBe("Site");
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
