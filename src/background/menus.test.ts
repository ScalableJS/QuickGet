import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestSettings } from "../../tests/fixtures/settings.js";
import { seedChromeStorage } from "../../tests/mocks/chrome.js";
import { server } from "../../tests/msw/server.js";

vi.mock("./alarms.js", () => ({
  ensureMonitoring: vi.fn(),
}));

import { handleContextMenuClick } from "./menus.js";

describe("context-menu routing", () => {
  beforeEach(() => {
    seedChromeStorage(
      createTestSettings({
        NASdir: "/share/Multimedia/Default",
        routingRules: [
          { namePattern: "*.mkv", destination: "/share/Multimedia/Movies" },
          { domain: "*.example.com", destination: "/share/Multimedia/Other" },
        ],
      }),
    );
  });

  it("sends the first matching rule's folder in move and uses the default for other URLs", async () => {
    const requests: URLSearchParams[] = [];

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddUrl", async ({ request }) => {
        requests.push(new URLSearchParams(await request.text()));
        return HttpResponse.json({ error: 0 });
      }),
    );

    await handleContextMenuClick({
      editable: false,
      linkUrl: "https://downloads.example.com/movie.mkv",
      menuItemId: "quickget-send-link",
    });
    await handleContextMenuClick({
      editable: false,
      linkUrl: "https://downloads.example.org/archive.zip",
      menuItemId: "quickget-send-link",
    });

    expect(requests).toHaveLength(2);
    expect(requests[0].get("move")).toBe("Multimedia/Movies");
    expect(requests[0].get("temp")).toBe("Download");
    expect(requests[0].get("url")).toBe("https://downloads.example.com/movie.mkv");
    expect(requests[1].get("move")).toBe("Multimedia/Default");
    expect(requests[1].get("temp")).toBe("Download");
    expect(requests[1].get("url")).toBe("https://downloads.example.org/archive.zip");
  });
});
