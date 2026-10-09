import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestSettings } from "../../../../tests/fixtures/settings.js";
import { seedChromeStorage } from "../../../../tests/mocks/chrome.js";
import { clearStatus, showStatus } from "../../components/statusPill/statusPill.js";

const apiMock = vi.hoisted(() => ({ addTorrent: vi.fn(), addUrls: vi.fn(), getApiClient: vi.fn() }));

vi.mock("../../shared/api", () => ({ ...apiMock, invalidateClientCache: vi.fn() }));
vi.mock("../../shared/monitor.js", () => ({ requestMonitoring: vi.fn() }));

import { uploadUrls } from "./batchUpload.js";
import { uploadTorrent } from "./torrentUpload.js";

describe("accepted upload feedback", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="status-bar hidden">
        <div id="status" class="hidden"><span id="status-message"></span></div>
      </div>
    `;
    seedChromeStorage(createTestSettings());
    apiMock.addTorrent.mockReset();
    apiMock.addUrls.mockReset();
    apiMock.getApiClient.mockResolvedValue(apiMock);
  });

  afterEach(() => {
    clearStatus();
    document.body.innerHTML = "";
  });

  it.each([
    [{ added: true }, "onSuccess", 'Added "accepted.torrent" to Download Station'],
    [{ added: false, duplicate: true }, "onDuplicate", '"accepted.torrent" already exists on Download Station'],
  ] as const)("keeps an accepted torrent outcome in the renderer when its callback fails", async (result, callback, message) => {
    apiMock.addTorrent.mockResolvedValue(result);

    await uploadTorrent(new File(["fixture"], "accepted.torrent"), {
      [callback]: () => {
        throw new Error("refresh failed");
      },
    });

    expect(document.getElementById("status-message")?.textContent).toBe(
      `${message}; follow-up refresh failed: refresh failed`,
    );
    expect(document.getElementById("status")?.getAttribute("aria-live")).toBe("polite");
  });

  it("keeps a partial batch acceptance in the renderer when its callback fails", async () => {
    apiMock.addUrls.mockResolvedValue([
      { url: "https://example.com/one", ok: true },
      { url: "https://example.com/two", ok: false, error: "denied" },
    ]);

    await uploadUrls(["https://example.com/one", "https://example.com/two"], {
      onSuccess: () => {
        throw new Error("refresh failed");
      },
    });

    expect(document.getElementById("status-message")?.textContent).toBe(
      "Added 1, failed 1; follow-up refresh failed: refresh failed",
    );
    expect(document.getElementById("status")?.getAttribute("aria-live")).toBe("polite");
  });

  it("keeps a full batch acceptance in the renderer when its callback fails asynchronously", async () => {
    apiMock.addUrls.mockResolvedValue([
      { url: "https://example.com/one", ok: true },
      { url: "https://example.com/two", ok: true },
    ]);

    await uploadUrls(["https://example.com/one", "https://example.com/two"], {
      onSuccess: async () => {
        throw new Error("refresh failed");
      },
    });

    expect(document.getElementById("status-message")?.textContent).toBe(
      "Added 2 downloads; follow-up refresh failed: refresh failed",
    );
    expect(document.getElementById("status")?.getAttribute("aria-live")).toBe("polite");
  });

  it("does not let an old accepted upload callback replace a newer direct confirmation", async () => {
    let rejectCallback!: (reason: Error) => void;
    apiMock.addTorrent.mockResolvedValue({ added: true });

    const upload = uploadTorrent(new File(["fixture"], "accepted.torrent"), {
      onSuccess: () =>
        new Promise<void>((_resolve, reject) => {
          rejectCallback = reject;
        }),
    });
    await vi.waitFor(() => expect(apiMock.addTorrent).toHaveBeenCalledTimes(1));
    showStatus("Settings saved", "success", { autoHideMs: 2500 });
    rejectCallback(new Error("late refresh failure"));
    await upload;

    expect(document.getElementById("status-message")?.textContent).toBe("Settings saved");
  });

  it("does not let an old upload result replace a newer direct confirmation or validation error", async () => {
    let resolveUpload!: (result: { added: true }) => void;
    apiMock.addTorrent.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const pending = uploadTorrent(new File(["fixture"], "accepted.torrent"));
    await vi.waitFor(() => expect(apiMock.addTorrent).toHaveBeenCalledTimes(1));
    showStatus("Settings saved", "success", { autoHideMs: 2500 });
    resolveUpload({ added: true });
    await pending;
    expect(document.getElementById("status-message")?.textContent).toBe("Settings saved");

    let rejectUpload!: (reason: Error) => void;
    apiMock.addTorrent.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectUpload = reject;
        }),
    );
    const rejected = uploadTorrent(new File(["fixture"], "old.torrent"));
    await vi.waitFor(() => expect(apiMock.addTorrent).toHaveBeenCalledTimes(2));
    await uploadTorrent(new File(["fixture"], "new.invalid"));
    rejectUpload(new Error("late upload failure"));
    await rejected;

    expect(document.getElementById("status-message")?.textContent).toBe("Please select a valid .torrent file");
  });
});
