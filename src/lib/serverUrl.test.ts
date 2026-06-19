import { describe, expect, it } from "vitest";

import { composeServerUrl, parseServerUrl } from "./serverUrl.js";

describe("serverUrl", () => {
  describe("composeServerUrl", () => {
    it("builds http URL with port", () => {
      expect(composeServerUrl({ NASsecure: false, NASaddress: "192.168.88.185", NASport: "8080" })).toBe(
        "http://192.168.88.185:8080",
      );
    });

    it("builds https URL with port", () => {
      expect(composeServerUrl({ NASsecure: true, NASaddress: "nas.local", NASport: "443" })).toBe(
        "https://nas.local:443",
      );
    });

    it("omits the port when empty", () => {
      expect(composeServerUrl({ NASsecure: false, NASaddress: "nas.local", NASport: "" })).toBe("http://nas.local");
    });

    it("returns empty string when address is missing", () => {
      expect(composeServerUrl({ NASsecure: true, NASaddress: "   ", NASport: "8080" })).toBe("");
    });
  });

  describe("parseServerUrl", () => {
    it("parses a full http URL", () => {
      expect(parseServerUrl("http://192.168.88.185:8080")).toEqual({
        NASsecure: false,
        NASaddress: "192.168.88.185",
        NASport: "8080",
      });
    });

    it("parses https with a non-default port", () => {
      expect(parseServerUrl("https://nas.local:5001")).toEqual({
        NASsecure: true,
        NASaddress: "nas.local",
        NASport: "5001",
      });
    });

    it("drops the default https port (443 is implied by the scheme)", () => {
      expect(parseServerUrl("https://nas.local:443")).toEqual({
        NASsecure: true,
        NASaddress: "nas.local",
        NASport: "",
      });
    });

    it("defaults to http when no scheme is given", () => {
      expect(parseServerUrl("192.168.88.185:8080")).toEqual({
        NASsecure: false,
        NASaddress: "192.168.88.185",
        NASport: "8080",
      });
    });

    it("leaves the port empty when none is provided", () => {
      expect(parseServerUrl("https://nas.local")).toEqual({
        NASsecure: true,
        NASaddress: "nas.local",
        NASport: "",
      });
    });

    it("trims surrounding whitespace", () => {
      expect(parseServerUrl("  http://nas.local:8080  ")).toEqual({
        NASsecure: false,
        NASaddress: "nas.local",
        NASport: "8080",
      });
    });

    it("throws on empty input", () => {
      expect(() => parseServerUrl("   ")).toThrow(/empty/i);
    });

    it("throws on an unusable address", () => {
      expect(() => parseServerUrl("http://")).toThrow(/Invalid server address/);
    });
  });
});
