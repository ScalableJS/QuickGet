import { describe, expect, it } from "vitest";

import { createTestSettings } from "../../tests/fixtures/settings";
import { seedChromeStorage } from "../../tests/mocks/chrome";

import {
  clearConnectionHealth,
  readConnectionState,
  recordFailure,
  recordSuccess,
} from "./connectionHealth.js";

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

  it("stays configured when the NAS is unreachable", async () => {
    seedChromeStorage(createTestSettings());
    await recordFailure(new Error("Failed to fetch"));

    const state = await readConnectionState(createTestSettings());

    // The settings were never wrong; only the NAS was away.
    expect(state.configured).toBe(true);
    expect(state.health.kind).toBe("unreachable");
  });

  it("distinguishes rejected credentials from an absent NAS", async () => {
    seedChromeStorage(createTestSettings());

    await recordFailure(new Error("The NAS rejected the username or password."));
    expect((await readConnectionState(createTestSettings())).health.kind).toBe("auth-failed");

    await recordFailure(new Error("Failed to fetch"));
    expect((await readConnectionState(createTestSettings())).health.kind).toBe("unreachable");
  });

  it("remembers the last success across a later failure", async () => {
    seedChromeStorage(createTestSettings());

    await recordSuccess();
    const succeededAt = (await readConnectionState(createTestSettings())).health.lastSuccessAt;
    expect(succeededAt).toBeDefined();

    await recordFailure(new Error("Failed to fetch"));
    const after = await readConnectionState(createTestSettings());

    // "Worked ten minutes ago" is the context that makes a failure readable.
    expect(after.health.lastSuccessAt).toBe(succeededAt);
  });

  it("forgets everything when the connection is removed", async () => {
    seedChromeStorage(createTestSettings());
    await recordSuccess();

    await clearConnectionHealth();

    expect((await readConnectionState(createTestSettings())).health.kind).toBe("unknown");
  });
});
