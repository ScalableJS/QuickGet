import { beforeEach, describe, expect, it, vi } from "vitest";
import { showStatus } from "@/popup/components";
import { createTestSettings } from "../../../../tests/fixtures/settings.js";
import { seedChromeStorage } from "../../../../tests/mocks/chrome.js";
import { getApiClient } from "../../shared/api";
import { requestMonitoring } from "../../shared/monitor.js";
import { uploadTorrent } from "./torrentUpload.js";

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

describe("torrentUpload", () => {
  const mockAddTorrent = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockAddTorrent.mockReset();
    seedChromeStorage(createTestSettings({ NASdir: "Multimedia/Default" }));
    vi.mocked(getApiClient).mockResolvedValue({
      addTorrent: mockAddTorrent,
    } as any);
  });

  it("rejects files without .torrent extension", async () => {
    const invalidFile = new File(["dummy"], "sample.mkv", { type: "video/x-matroska" });
    await uploadTorrent(invalidFile);

    expect(showStatus).toHaveBeenCalledWith("Please select a valid .torrent file", "error");
    expect(mockAddTorrent).not.toHaveBeenCalled();
  });

  it("handles successful torrent upload", async () => {
    const file = new File(["dummy"], "linux.torrent", { type: "application/x-bittorrent" });
    mockAddTorrent.mockResolvedValueOnce({ added: true });

    const onSuccess = vi.fn();
    await uploadTorrent(file, { onSuccess });

    expect(mockAddTorrent).toHaveBeenCalledWith(file, { targetFolder: "Multimedia/Default" });
    expect(requestMonitoring).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it("handles duplicate torrent detection", async () => {
    const file = new File(["dummy"], "existing.torrent", { type: "application/x-bittorrent" });
    mockAddTorrent.mockResolvedValueOnce({ added: false, duplicate: true });

    const onDuplicate = vi.fn();
    await uploadTorrent(file, { onDuplicate });

    expect(showStatus).toHaveBeenCalledWith(expect.stringContaining("already exists on Download Station"), "info", {
      autoHideMs: 2000,
    });
    expect(onDuplicate).toHaveBeenCalledWith("existing.torrent");
  });

  it("handles API failure response", async () => {
    const file = new File(["dummy"], "fail.torrent", { type: "application/x-bittorrent" });
    mockAddTorrent.mockResolvedValueOnce({ added: false, duplicate: false });

    await uploadTorrent(file);

    expect(showStatus).toHaveBeenCalledWith("Failed to add torrent", "error");
  });

  it("handles unexpected network exception", async () => {
    const file = new File(["dummy"], "error.torrent", { type: "application/x-bittorrent" });
    mockAddTorrent.mockRejectedValueOnce(new Error("Network disconnect"));

    await uploadTorrent(file);

    expect(showStatus).toHaveBeenCalledWith("Error: Network disconnect", "error");
  });

  /**
   * The same torrent clicked on a tracker obeys routing rules; dropped into the popup it used to
   * ignore them and land in the global Target. The file itself carries the release name.
   */
  it("routes an uploaded torrent by its content name, like every other send path", async () => {
    seedChromeStorage(
      createTestSettings({
        NASdir: "Multimedia/Default",
        routingRules: [{ namePattern: "*.mkv", destination: "Multimedia/Movies" }],
      }),
    );
    const torrent = new File([buildTorrentBytes("Some.Movie.2024.mkv")], "1234.torrent", {
      type: "application/x-bittorrent",
    });
    mockAddTorrent.mockResolvedValueOnce({ added: true });

    await uploadTorrent(torrent);

    expect(mockAddTorrent).toHaveBeenCalledWith(torrent, { targetFolder: "Multimedia/Movies" });
  });
});

/** A minimal single-file torrent: only `info.name` matters to routing. */
function buildTorrentBytes(contentName: string): string {
  return `d4:infod6:lengthi1e4:name${contentName.length}:${contentName}12:piece lengthi16384eee`;
}
