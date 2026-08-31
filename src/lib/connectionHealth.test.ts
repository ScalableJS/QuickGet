import { describe, expect, it } from "vitest";

import { createTestSettings } from "../../tests/fixtures/settings";
import { connectionFailure, readConnectionState } from "./connectionHealth.js";

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
