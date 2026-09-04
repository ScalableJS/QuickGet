import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleMagnetAdd } from "./magnetHandler.js";

const mockAddUrl = vi.fn();
const mockEnsureMonitoring = vi.fn();
const mockMarkConfigurationProblem = vi.fn();

vi.mock("@api/client.js", () => ({
  createApiClient: () => ({
    addUrl: mockAddUrl,
  }),
}));

vi.mock("@lib/settings.js", () => ({
  loadSettings: async () => ({
    NASaddress: "127.0.0.1",
    NASport: "8080",
    NASsecure: false,
    NASlogin: "admin",
    NASpassword: "pwd",
    NAStempdir: "Download",
    NASdir: "Multimedia/Movies",
    autoCaptureMagnets: true,
    torrentInterceptMode: "always",
    suppressLocalTorrentFile: false,
    routingRules: [
      {
        type: "magnet",
        namePattern: "*Linux*",
        destination: "Software/Linux",
      },
    ],
    theme: "auto",
  }),
}));

vi.mock("./alarms.js", () => ({
  ensureMonitoring: () => mockEnsureMonitoring(),
}));

vi.mock("./actions.js", () => ({
  markConfigurationProblem: (err: string) => mockMarkConfigurationProblem(err),
}));

describe("magnetHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddUrl.mockResolvedValue(true);
  });

  it("sends magnet to NAS with destination resolved from routing rules", async () => {
    const magnet = "magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678&dn=Arch+Linux+2026";
    const result = await handleMagnetAdd(magnet);

    expect(result.ok).toBe(true);
    expect(mockAddUrl).toHaveBeenCalledWith(magnet, {
      targetFolder: "Software/Linux",
    });
    expect(mockEnsureMonitoring).toHaveBeenCalled();
  });

  it("falls back to NASdir when no routing rules match", async () => {
    const magnet = "magnet:?xt=urn:btih:fedcba0987654321fedcba0987654321fedcba09&dn=Summer+Holiday";
    const result = await handleMagnetAdd(magnet);

    expect(result.ok).toBe(true);
    expect(mockAddUrl).toHaveBeenCalledWith(magnet, {
      targetFolder: "Multimedia/Movies",
    });
  });

  it("deduplicates identical requests in short succession", async () => {
    const magnet = "magnet:?xt=urn:btih:1111222233334444555566667777888899990000";
    const first = await handleMagnetAdd(magnet);
    const second = await handleMagnetAdd(magnet);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.deduped).toBe(true);
    expect(mockAddUrl).toHaveBeenCalledTimes(1);
  });

  it("returns error and marks problem when NAS call fails", async () => {
    mockAddUrl.mockRejectedValueOnce(new Error("Connection refused"));
    const magnet = "magnet:?xt=urn:btih:fail111122223333444455556666777788889999";

    const result = await handleMagnetAdd(magnet);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Connection refused");
    expect(mockMarkConfigurationProblem).toHaveBeenCalled();
  });
});
