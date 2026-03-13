import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import {
  buildNASBaseUrl,
  createOpenApiFetchClient,
  performLogin,
} from "./index.js";
import { server } from "../../tests/msw/server";
import { createTestSettings } from "../../tests/fixtures/settings";

function serializeUrlEncoded(body: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  return params;
}

describe("api/index", () => {
  describe("buildNASBaseUrl", () => {
    it("builds http and https NAS URLs from settings", () => {
      expect(buildNASBaseUrl(createTestSettings())).toBe("http://nas.local:8080");
      expect(buildNASBaseUrl(createTestSettings({ NASsecure: true, NASport: "443" }))).toBe(
        "https://nas.local:443"
      );
      expect(buildNASBaseUrl(createTestSettings({ NASport: "" }))).toBe("http://nas.local");
    });

    it("throws on empty address or invalid port", () => {
      expect(() => buildNASBaseUrl(createTestSettings({ NASaddress: "   " }))).toThrow(
        /NAS address is empty/
      );
      expect(() => buildNASBaseUrl(createTestSettings({ NASport: "eighty" }))).toThrow(
        /Invalid NAS port/
      );
    });
  });

  describe("performLogin", () => {
    it("posts encoded credentials and returns SID/user", async () => {
      const settings = createTestSettings();
      let loginBody = "";

      server.use(
        http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", async ({ request }) => {
          loginBody = await request.text();
          return HttpResponse.json({ error: 0, sid: "SID-123", user: "admin" });
        })
      );

      await expect(performLogin(settings)).resolves.toEqual({ sid: "SID-123", user: "admin" });
      expect(loginBody).toContain("user=admin");
      expect(loginBody).toContain(`pass=${encodeURIComponent(btoa("secret"))}`);
    });

    it("supports non-latin passwords by UTF-8 encoding before base64", async () => {
      const settings = createTestSettings({ NASpassword: "79ггьчкЯУ" });
      let loginBody = "";

      server.use(
        http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", async ({ request }) => {
          loginBody = await request.text();
          return HttpResponse.json({ error: 0, sid: "SID-UTF8", user: "admin" });
        })
      );

      await expect(performLogin(settings)).resolves.toEqual({ sid: "SID-UTF8", user: "admin" });

      const expectedBase64 = Buffer.from("79ггьчкЯУ", "utf8").toString("base64");
      expect(loginBody).toContain(`pass=${encodeURIComponent(expectedBase64)}`);
    });

    it("falls back to the raw password when the encoded login attempt returns auth error 4", async () => {
      const settings = createTestSettings({ NASpassword: "пароль" });
      const loginBodies: string[] = [];

      server.use(
        http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", async ({ request }) => {
          loginBodies.push(await request.text());
          if (loginBodies.length === 1) {
            return HttpResponse.json({ error: 4, reason: "" });
          }
          return HttpResponse.json({ error: 0, sid: "SID-RAW", user: "admin" });
        })
      );

      await expect(performLogin(settings)).resolves.toEqual({ sid: "SID-RAW", user: "admin" });
      expect(loginBodies).toHaveLength(2);
      expect(loginBodies[0]).toContain(`pass=${encodeURIComponent(Buffer.from("пароль", "utf8").toString("base64"))}`);
      expect(loginBodies[1]).toContain(`pass=${encodeURIComponent("пароль")}`);
    });

    it("throws when login response has no SID", async () => {
      const settings = createTestSettings();

      server.use(
        http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
          HttpResponse.json({ user: "admin" })
        )
      );

      await expect(performLogin(settings)).rejects.toThrow(/NAS login failed/i);
    });
  });

  describe("createOpenApiFetchClient", () => {
    it("logs in once and injects SID into urlencoded requests", async () => {
      const settings = createTestSettings();
      const client = createOpenApiFetchClient({ settings, fetchFn: fetch });

      let loginHits = 0;
      let protectedBody = "";

      server.use(
        http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () => {
          loginHits += 1;
          return HttpResponse.json({ error: 0, sid: "SID-XYZ", user: "admin" });
        }),
        http.post("http://nas.local:8080/downloadstation/V4/Task/Query", async ({ request }) => {
          protectedBody = await request.text();
          return HttpResponse.json({
            error: 0,
            data: [],
            status: {
              active: 0,
              all: 0,
              bt: 0,
              completed: 0,
              down_rate: 0,
              downloading: 0,
              inactive: 0,
              paused: 0,
              seeding: 0,
              stopped: 0,
              up_rate: 0,
              url: 0,
            },
            total: 0,
          });
        })
      );

      const response = await client.POST("/downloadstation/V4/Task/Query", {
        body: {
          sid: "",
          limit: 25,
          field: "priority",
          direction: "DESC",
          status: "all",
          type: "all",
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        },
        bodySerializer: serializeUrlEncoded,
      });

      expect(response.error).toBeUndefined();
      expect(loginHits).toBe(1);
      expect(protectedBody).toContain("sid=SID-XYZ");
      expect(protectedBody).toContain("limit=25");
      expect(protectedBody).toContain("field=priority");
    });

  });
});







