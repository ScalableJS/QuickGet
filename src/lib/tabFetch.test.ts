import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFromPageContext } from "./tabFetch.js";

describe("tabFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined when chrome extension APIs are absent", async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {};
    const res = await fetchFromPageContext("https://tracker.org/download.torrent");
    expect(res).toBeUndefined();
  });

  it("returns undefined for invalid malformed URLs", async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      scripting: { executeScript: vi.fn() },
      tabs: { query: vi.fn() },
    };
    const res = await fetchFromPageContext("not-a-url");
    expect(res).toBeUndefined();
  });

  it("returns undefined when no matching tabs are found on the origin", async () => {
    const querySpy = vi.fn().mockResolvedValue([]);
    (globalThis as unknown as { chrome: unknown }).chrome = {
      scripting: { executeScript: vi.fn() },
      tabs: { query: querySpy },
    };

    const res = await fetchFromPageContext("https://tracker.org/download.torrent");
    expect(querySpy).toHaveBeenCalledWith({ url: "https://tracker.org/*" });
    expect(res).toBeUndefined();
  });

  it("executes script in tab and reconstructs Response object", async () => {
    const tabs = [
      { id: 101, url: "https://tracker.org/browse" },
      { id: 102, url: "https://tracker.org/details/42" },
    ];
    const querySpy = vi.fn().mockResolvedValue(tabs);

    const testBytes = new TextEncoder().encode("d8:announce…e");
    let binary = "";
    for (let i = 0; i < testBytes.length; i += 1) {
      binary += String.fromCharCode(testBytes[i]);
    }
    const base64 = btoa(binary);

    const executeSpy = vi.fn().mockResolvedValue([
      {
        result: {
          ok: true,
          status: 200,
          contentType: "application/x-bittorrent",
          contentDisposition: 'attachment; filename="test.torrent"',
          base64,
        },
      },
    ]);

    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: { query: querySpy },
      scripting: { executeScript: executeSpy },
    };

    const res = await fetchFromPageContext("https://tracker.org/download.torrent", "https://tracker.org/details/42");

    expect(executeSpy).toHaveBeenCalledWith({
      target: { tabId: 102 },
      world: "MAIN",
      func: expect.any(Function),
      args: ["https://tracker.org/download.torrent"],
    });

    expect(res).toBeDefined();
    if (!res) throw new Error("Expected response");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-bittorrent");
    const body = await res.arrayBuffer();
    expect(Array.from(new Uint8Array(body))).toEqual(Array.from(testBytes));
  });

  it("handles injection exceptions gracefully and returns undefined", async () => {
    const querySpy = vi.fn().mockResolvedValue([{ id: 101, url: "https://tracker.org/browse" }]);
    const executeSpy = vi.fn().mockRejectedValue(new Error("Cannot access a chrome:// URL"));

    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: { query: querySpy },
      scripting: { executeScript: executeSpy },
    };

    const res = await fetchFromPageContext("https://tracker.org/download.torrent");
    expect(res).toBeUndefined();
  });
});
