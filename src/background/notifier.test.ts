import { describe, expect, it, vi } from "vitest";

import { clearFailureEpisode, notifyDirect, notifyFailure } from "./notifier.js";

describe("failure notification episodes", () => {
  it("serializes concurrent identical failures into one notification", async () => {
    let releaseCreate!: () => void;
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    vi.mocked(chrome.notifications.create).mockImplementationOnce(async () => {
      await createGate;
      return "episode";
    });

    const first = notifyFailure("unreachable", "Download Station unavailable", "Try again later", "nas-a");
    const second = notifyFailure("unreachable", "Download Station unavailable", "Try again later", "nas-a");
    await vi.waitFor(() => expect(chrome.notifications.create).toHaveBeenCalledOnce());

    releaseCreate();
    await Promise.all([first, second]);

    expect(chrome.notifications.create).toHaveBeenCalledOnce();
    expect(await chrome.storage.session.get("qg:notificationEpisode")).toEqual({
      "qg:notificationEpisode": expect.objectContaining({ kind: "unreachable", fingerprint: "nas-a" }),
    });
  });

  it("orders recovery after an in-flight notification write", async () => {
    let releaseCreate!: () => void;
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    vi.mocked(chrome.notifications.create).mockImplementationOnce(async () => {
      await createGate;
      return "episode";
    });

    const failure = notifyFailure("auth", "Authentication failed", "Check credentials", "nas-a");
    const recovery = clearFailureEpisode();
    releaseCreate();
    await Promise.all([failure, recovery]);

    expect(await chrome.storage.session.get("qg:notificationEpisode")).toEqual({ "qg:notificationEpisode": undefined });
  });

  it("does not suppress a retry when native notification delivery rejects", async () => {
    vi.mocked(chrome.notifications.create).mockRejectedValueOnce(new Error("notifications denied"));

    await notifyFailure("handoff", "Could not hand off torrent", "Try again", "torrent-a");
    expect(await chrome.storage.session.get("qg:notificationEpisode")).toEqual({ "qg:notificationEpisode": undefined });

    await notifyFailure("handoff", "Could not hand off torrent", "Try again", "torrent-a");
    expect(chrome.notifications.create).toHaveBeenCalledTimes(2);
  });

  it("contains direct-notification promise rejections for unawaited callers", async () => {
    vi.mocked(chrome.notifications.create).mockRejectedValueOnce(new Error("notifications denied"));

    expect(() => notifyDirect("QuickGet", "Could not send torrent")).not.toThrow();
    await Promise.resolve();
  });
});
