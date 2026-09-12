import { delay, HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { createTestSettings } from "../../tests/fixtures/settings";
import { server } from "../../tests/msw/server";
import { connectionFailure, PING_TIMEOUT_MS, pingNas, readConnectionState } from "./connectionHealth.js";

const LOGIN_URL = "http://nas.local:8080/downloadstation/V4/Misc/Login";

/**
 * Configuration and health are separate axes. Conflating them is what would send a user with
 * perfectly correct settings back to an empty form because the NAS happened to be switched off.
 */
describe("connection state", () => {
  it("is unconfigured until every required setting is present", async () => {
    const incomplete = createTestSettings({ NAStempdir: "" });

    expect((await readConnectionState(incomplete)).configured).toBe(false);
    expect((await readConnectionState(createTestSettings())).configured).toBe(true);
  });

  it("distinguishes rejected credentials from an absent NAS", async () => {
    expect(connectionFailure(new Error("The NAS rejected the username or password.")).kind).toBe("auth-failed");
    expect(connectionFailure(new Error("Failed to fetch")).kind).toBe("unreachable");
  });

  it("never restores a previous health result", async () => {
    expect((await readConnectionState(createTestSettings())).health.kind).toBe("unknown");
  });
});

/**
 * The three answers worth telling apart, each asserted against a NAS that behaves like the real
 * one does in that situation. The fourth case — a NAS that accepts the connection and then says
 * nothing — is the one that used to hang the settings screen for half a minute, so it is asserted
 * on the clock, not only on the verdict.
 */
describe("pingNas", () => {
  it("reports ready when the NAS accepts the credentials", async () => {
    server.use(http.post(LOGIN_URL, () => HttpResponse.json({ error: 0, sid: "SID-1", user: "admin" })));

    const health = await pingNas(createTestSettings());

    expect(health.kind).toBe("ready");
    expect(health.lastSuccessAt).toBeTypeOf("number");
  });

  it("reports auth-failed on a rejected password, and says which two settings to look at", async () => {
    let attempts = 0;
    server.use(
      http.post(LOGIN_URL, () => {
        attempts += 1;
        return HttpResponse.json({ error: 4, reason: "login failed" });
      }),
    );

    const health = await pingNas(createTestSettings());

    expect(health.kind).toBe("auth-failed");
    expect(health.detail).toBe("The NAS rejected the username or password. Check them in Settings.");
    // Two, not one: a rejected base64 password is retried raw, because some firmware wants it
    // that way. Both attempts share the ping's single budget, so the retry cannot double the wait.
    expect(attempts).toBe(2);
  });

  it("reports unreachable and names the host when the connection fails", async () => {
    server.use(http.post(LOGIN_URL, () => HttpResponse.error()));

    const health = await pingNas(createTestSettings());

    expect(health.kind).toBe("unreachable");
    expect(health.detail).toContain("nas.local:8080");
  });

  it("gives up on a NAS that accepts the connection and then says nothing", async () => {
    server.use(
      http.post(LOGIN_URL, async () => {
        await delay(5_000);
        return HttpResponse.json({ error: 0, sid: "TOO-LATE", user: "admin" });
      }),
    );

    const startedAt = Date.now();
    const health = await pingNas(createTestSettings(), { timeoutMs: 150 });
    const elapsed = Date.now() - startedAt;

    expect(health.kind).toBe("unreachable");
    expect(health.detail).toMatch(/did not answer/);
    // The point of the whole change: the answer arrives on our schedule, not the TCP stack's.
    expect(elapsed).toBeLessThan(2_000);
  });

  it("treats a NAS that answers with an HTTP error as unreachable, not as bad credentials", async () => {
    server.use(http.post(LOGIN_URL, () => new HttpResponse(null, { status: 502, statusText: "Bad Gateway" })));

    expect((await pingNas(createTestSettings())).kind).toBe("unreachable");
  });

  it("returns a verdict rather than throwing when the address is unusable", async () => {
    const health = await pingNas(createTestSettings({ NASaddress: "   " }));

    expect(health.kind).toBe("unreachable");
    expect(health.detail).toMatch(/NAS address is empty/);
  });

  it("states the budget it waited, in the message the user reads", () => {
    const timedOut = new DOMException("The operation was aborted due to timeout", "TimeoutError");

    const health = connectionFailure(timedOut, { address: "nas.local:8080", timeoutMs: PING_TIMEOUT_MS });

    expect(health.detail).toBe("nas.local:8080 did not answer within 5 s. It may be asleep or on another network.");
  });
});
