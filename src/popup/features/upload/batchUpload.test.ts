import { beforeEach, describe, expect, it, vi } from "vitest";
import { showStatus } from "@/popup/components";
import { getApiClient } from "../../shared/api";
import { requestMonitoring } from "../../shared/monitor.js";
import { parseUrlLines, uploadUrls } from "./batchUpload.js";

vi.mock("@/popup/components", () => ({
  showStatus: vi.fn(),
}));

vi.mock("../../shared/api", () => ({
  getApiClient: vi.fn(),
  invalidateClientCache: vi.fn(),
}));

vi.mock("../../shared/monitor.js", () => ({
  requestMonitoring: vi.fn(),
}));

describe("batchUpload", () => {
  const mockAddUrls = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockAddUrls.mockReset();
    vi.mocked(getApiClient).mockResolvedValue({
      addUrls: mockAddUrls,
    } as any);
  });

  describe("parseUrlLines", () => {
    it("splits textarea content into trimmed non-empty URL lines", () => {
      const raw = `
        http://example.com/file1.zip
        
        https://tracker.org/download?id=2   
        
        http://mirror.net/iso.img
      `;
      expect(parseUrlLines(raw)).toEqual([
        "http://example.com/file1.zip",
        "https://tracker.org/download?id=2",
        "http://mirror.net/iso.img",
      ]);
    });

    it("returns empty array for whitespace-only input", () => {
      expect(parseUrlLines("   \n\n  \t  ")).toEqual([]);
    });
  });

  describe("uploadUrls", () => {
    it("rejects empty URL lists with error message", async () => {
      await uploadUrls([]);
      expect(showStatus).toHaveBeenCalledWith("Enter at least one URL", "error");
      expect(mockAddUrls).not.toHaveBeenCalled();
    });

    it("rejects batches larger than 50 URLs", async () => {
      const urls = Array.from({ length: 51 }, (_, i) => `http://example.com/${i}.zip`);
      await uploadUrls(urls);
      expect(showStatus).toHaveBeenCalledWith("Too many URLs (max 50)", "error");
      expect(mockAddUrls).not.toHaveBeenCalled();
    });

    it("successfully adds URLs, requests monitoring, and calls onSuccess", async () => {
      const urls = ["http://example.com/1.zip", "http://example.com/2.zip"];
      mockAddUrls.mockResolvedValueOnce([
        { url: urls[0], ok: true },
        { url: urls[1], ok: true },
      ]);

      const onSuccess = vi.fn();
      await uploadUrls(urls, { targetFolder: "Multimedia/Downloads", onSuccess });

      expect(mockAddUrls).toHaveBeenCalledWith(urls, { targetFolder: "Multimedia/Downloads" });
      expect(requestMonitoring).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });

    it("reports partial failures when some URLs are rejected", async () => {
      const urls = ["http://example.com/1.zip", "http://example.com/2.zip"];
      mockAddUrls.mockResolvedValueOnce([
        { url: urls[0], ok: true },
        { url: urls[1], ok: false, error: "Disk full" },
      ]);

      const onSuccess = vi.fn();
      await uploadUrls(urls, { onSuccess });

      expect(requestMonitoring).toHaveBeenCalled();
      expect(showStatus).toHaveBeenCalledWith("Added 1, failed 1", "info", { autoHideMs: 3000 });
      expect(onSuccess).toHaveBeenCalled();
    });

    it("reports total failure when all URLs fail", async () => {
      const urls = ["http://example.com/1.zip"];
      mockAddUrls.mockResolvedValueOnce([{ url: urls[0], ok: false, error: "Offline" }]);

      const onSuccess = vi.fn();
      await uploadUrls(urls, { onSuccess });

      expect(requestMonitoring).not.toHaveBeenCalled();
      expect(showStatus).toHaveBeenCalledWith("Failed to add 1 URL(s)", "error");
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("catches and reports unexpected client exceptions", async () => {
      mockAddUrls.mockRejectedValueOnce(new Error("Network timeout"));

      await uploadUrls(["http://example.com/1.zip"]);

      expect(showStatus).toHaveBeenCalledWith("Error: Network timeout", "error");
    });
  });
});
