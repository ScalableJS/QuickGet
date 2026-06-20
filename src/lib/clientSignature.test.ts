import { describe, expect, it } from "vitest";

import { createTestSettings } from "../../tests/fixtures/settings";

import { clientSignature } from "./clientSignature.js";

describe("clientSignature", () => {
  it("is stable for identical settings", () => {
    expect(clientSignature(createTestSettings())).toBe(clientSignature(createTestSettings()));
  });

  it("ignores UI-only fields that don't change how requests are sent", () => {
    const base = createTestSettings();
    const tweaked = createTestSettings({
      torrentInterceptMode: "always",
      rememberPassword: true,
      routingRules: [{ destination: "Movies" }],
    });
    expect(clientSignature(tweaked)).toBe(clientSignature(base));
  });

  it.each([
    ["NASsecure", { NASsecure: true }],
    ["NASaddress", { NASaddress: "other.local" }],
    ["NASport", { NASport: "9090" }],
    ["NASlogin", { NASlogin: "someone" }],
    ["NASpassword", { NASpassword: "changed" }],
    ["NAStempdir", { NAStempdir: "Other" }],
    ["NASdir", { NASdir: "Other/Dir" }],
  ] as const)("changes when %s changes", (_field, override) => {
    expect(clientSignature(createTestSettings(override))).not.toBe(clientSignature(createTestSettings()));
  });
});
