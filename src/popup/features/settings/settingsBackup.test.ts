import { describe, expect, it } from "vitest";

import { createTestSettings } from "../../../../tests/fixtures/settings.js";
import { describeImport, exportSettings, parseImportedSettings } from "./settingsBackup.js";

describe("exportSettings", () => {
  it("excludes credentials and wraps with metadata", () => {
    const settings = createTestSettings({ NASpassword: "topsecret", rememberPassword: true });
    const json = exportSettings(settings, new Date("2026-06-20T10:00:00.000Z"));
    const parsed = JSON.parse(json);

    expect(parsed.app).toBe("quickget-remote");
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBe("2026-06-20T10:00:00.000Z");
    expect(parsed.settings.NASaddress).toBe("nas.local");
    expect(parsed.settings).not.toHaveProperty("NASpassword");
    expect(parsed.settings).not.toHaveProperty("rememberPassword");
  });

  it("round-trips through parseImportedSettings", () => {
    const settings = createTestSettings({ routingRules: [{ namePattern: "*.mkv", destination: "Movies" }] });
    const restored = parseImportedSettings(exportSettings(settings));
    expect(restored.NASaddress).toBe(settings.NASaddress);
    expect(restored.routingRules).toEqual([{ namePattern: "*.mkv", destination: "Movies" }]);
    expect(restored).not.toHaveProperty("NASpassword");
  });
});

describe("parseImportedSettings", () => {
  it("accepts a bare settings object (no wrapper)", () => {
    const result = parseImportedSettings(JSON.stringify({ NASaddress: "10.0.0.5", NASport: "8080" }));
    expect(result).toEqual({ NASaddress: "10.0.0.5", NASport: "8080" });
  });

  it("drops ill-typed and unknown keys", () => {
    const result = parseImportedSettings(
      JSON.stringify({ NASsecure: "yes", NASport: 8080, NASlogin: "admin", bogus: 1 }),
    );
    expect(result).toEqual({ NASlogin: "admin" });
  });

  it("keeps only valid routing rules", () => {
    const result = parseImportedSettings(
      JSON.stringify({
        NASlogin: "admin",
        routingRules: [{ destination: "Movies", type: "url" }, { type: "magnet" }, "junk"],
      }),
    );
    expect(result.routingRules).toEqual([{ destination: "Movies", type: "url" }]);
  });

  it("omits routingRules entirely when the import has none (won't clobber existing rules)", () => {
    const result = parseImportedSettings(JSON.stringify({ NASlogin: "admin" }));
    expect(result).not.toHaveProperty("routingRules");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseImportedSettings("{not json")).toThrow(/valid JSON/);
  });

  it("throws when nothing recognizable is present", () => {
    expect(() => parseImportedSettings(JSON.stringify({ foo: "bar" }))).toThrow(/recognizable/);
  });
});

/**
 * The confirmation names what a backup will replace. Without it the user is asked to trust a
 * file whose contents they cannot see — and the old behaviour applied it before asking at all.
 */
describe("describeImport", () => {
  it("names the settings a backup carries, in human terms", () => {
    const changes = describeImport({
      NASaddress: "nas.local",
      NASlogin: "admin",
      NAStempdir: "Download",
      theme: "dark",
    });

    expect(changes).toContain("Server address");
    expect(changes).toContain("Username");
    expect(changes).toContain("Temp Folder");
    expect(changes).toContain("Theme");
  });

  it("counts routing rules, since the number is what the user is losing", () => {
    const changes = describeImport({
      routingRules: [
        { namePattern: "*.mkv", destination: "Movies" },
        { domain: "example.com", destination: "Other" },
      ],
    });

    expect(changes).toEqual(["Routing rules (2)"]);
  });

  it("is empty for a backup that carries nothing importable", () => {
    expect(describeImport({})).toEqual([]);
  });
});
