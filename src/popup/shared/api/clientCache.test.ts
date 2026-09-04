import { DEFAULTS, type Settings } from "@lib/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getApiClient, invalidateClientCache } from "./clientCache";

const mockLoadSettings = vi.fn<() => Promise<Settings>>();
vi.mock("@lib/settings.js", () => ({
  loadSettings: () => mockLoadSettings(),
}));

describe("clientCache", () => {
  beforeEach(() => {
    invalidateClientCache();
    vi.clearAllMocks();
    mockLoadSettings.mockResolvedValue({
      ...DEFAULTS,
      NASaddress: "192.168.1.100",
      NASlogin: "admin",
      NASpassword: "pwd",
    });
  });

  it("returns throwaway client when explicit settings are provided without caching it", async () => {
    const explicitSettings: Settings = {
      ...DEFAULTS,
      NASaddress: "10.0.0.1",
      NASlogin: "temp",
      NASpassword: "pwd",
    };

    const client1 = await getApiClient({ settings: explicitSettings });
    const client2 = await getApiClient({ settings: explicitSettings });

    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
    expect(client1).not.toBe(client2);
    expect(mockLoadSettings).not.toHaveBeenCalled();
  });

  it("caches client instance by settings signature", async () => {
    const client1 = await getApiClient();
    const client2 = await getApiClient();

    expect(client1).toBe(client2);
    expect(mockLoadSettings).toHaveBeenCalledTimes(2);
  });

  it("recreates client when settings signature changes", async () => {
    const client1 = await getApiClient();

    mockLoadSettings.mockResolvedValue({
      ...DEFAULTS,
      NASaddress: "192.168.1.200", // changed address
      NASlogin: "admin",
      NASpassword: "pwd",
    });

    const client2 = await getApiClient();
    expect(client1).not.toBe(client2);
  });

  it("clears cache on invalidateClientCache()", async () => {
    const client1 = await getApiClient();
    invalidateClientCache();
    const client2 = await getApiClient();

    expect(client1).not.toBe(client2);
  });
});
