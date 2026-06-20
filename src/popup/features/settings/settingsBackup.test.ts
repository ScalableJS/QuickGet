import { describe, expect, it } from "vitest";

import { createTestSettings } from "../../../../tests/fixtures/settings.js";
import { exportSettings, parseImportedSettings } from "./settingsBackup.js";

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

  it("throws on invalid JSON", () => {
    expect(() => parseImportedSettings("{not json")).toThrow(/valid JSON/);
  });

  it("throws when nothing recognizable is present", () => {
    expect(() => parseImportedSettings(JSON.stringify({ foo: "bar" }))).toThrow(/recognizable/);
  });
});
