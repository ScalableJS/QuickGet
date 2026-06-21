import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { createTestSettings } from "../../tests/fixtures/settings";
import { server } from "../../tests/msw/server";

import { createApiClient } from "./client.js";

describe("ApiClient", () => {
  it("normalizes queried QNAP tasks and reuses a cached SID across calls", async () => {
    const settings = createTestSettings();
    const client = createApiClient({ settings, fetchFn: fetch });

    let loginHits = 0;
    let queryBody = "";
    let torrentBody = "";

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () => {
        loginHits += 1;
        return HttpResponse.json({
          admin: 1,
          error: 0,
          privilege: 1,
          sid: "SID-QNAP",
          token: "TOKEN-QNAP",
          user: "admin",
        });
      }),
      http.post("http://nas.local:8080/downloadstation/V4/Task/Query", async ({ request }) => {
        queryBody = await request.text();
        return HttpResponse.json({
          error: 0,
          data: [
            {
              activity_time: 0,
              caller: "Download Station",
              caller_meta: "",
              category: 1,
              choose_files: 1,
              comment: "",
              create_time: "2026/02/19 04:41:55 pm",
              done: 0,
              down_rate: 0,
              down_size: 0,
              error: 0,
              eta: -1,
              finish_time: "2026/02/19 05:25:31 pm",
              hash: "ABC123",
              move: "Download",
              path: "/Download",
              peers: 0,
              priority: 0,
              progress: 100,
              seeds: 0,
              share: 0,
              size: 100,
              source: "Ubuntu ISO",
              source_name: "Ubuntu ISO",
              start_time: "2026/02/19 04:41:55 pm",
              state: 5,
              temp: "Download",
              total_down: 100,
              total_up: 10,
              total_files: 1,
              type: "BT",
              uid: 0,
              up_rate: 0,
              up_size: 10,
              username: "admin",
              wakeup_time: "",
            },
          ],
          status: {
            active: 0,
            all: 1,
            bt: 1,
            completed: 1,
            down_rate: 0,
            downloading: 0,
            inactive: 1,
            paused: 0,
            seeding: 0,
            stopped: 0,
            up_rate: 0,
            url: 0,
          },
          total: 1,
        });
      }),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", async ({ request }) => {
        torrentBody = await request.text();
        return HttpResponse.json({ error: 0 });
      }),
    );

    const queried = await client.queryTasks();
    const added = await client.addTorrent(
      new File(["torrent-body"], "ubuntu.torrent", { type: "application/x-bittorrent" }),
    );

    expect(loginHits).toBe(2);
    expect(queryBody).toContain("sid=SID-QNAP");
    expect(queried.tasks).toHaveLength(1);
    expect(queried.tasks[0]).toMatchObject({
      id: "ABC123",
      hash: "ABC123",
      name: "Ubuntu ISO",
      status: "finished",
      progress: 100,
      source: "qnap",
    });
    expect(added).toEqual({ added: true });
    expect(torrentBody).toContain('name="sid"');
    expect(torrentBody).toContain("SID-QNAP");
    expect(torrentBody).toContain('name="temp"');
    expect(torrentBody).toContain("Download");
    expect(torrentBody).toContain('name="move"');
    expect(torrentBody).toContain("Multimedia/Movies");
    expect(torrentBody).toContain('name="dest_path"');
    expect(torrentBody).toContain('name="bt"');
    expect(torrentBody).toContain('name="bt_task"');
    // Paths must be relative — an absolute /share/... is rejected by DS (error 4096).
    expect(torrentBody).not.toContain("/share/");
  });

  it("sends temp and move (not savepath) when adding a URL", async () => {
    const settings = createTestSettings();
    const client = createApiClient({ settings, fetchFn: fetch });

    let addBody = "";

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddUrl", async ({ request }) => {
        addBody = await request.text();
        return HttpResponse.json({ error: 0 });
      }),
    );

    await expect(client.addUrl("http://example.com/file.zip")).resolves.toBe(true);

    const params = new URLSearchParams(addBody);
    expect(params.get("url")).toBe("http://example.com/file.zip");
    expect(params.get("temp")).toBe("Download");
    expect(params.get("move")).toBe("Multimedia/Movies");
    expect(params.has("savepath")).toBe(false);
  });

  it("removes only the task by default and removes its files when clean is requested", async () => {
    const settings = createTestSettings();
    const client = createApiClient({ settings, fetchFn: fetch });

    const bodies: string[] = [];

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/Remove", async ({ request }) => {
        bodies.push(await request.text());
        return HttpResponse.json({ error: 0 });
      }),
    );

    await expect(client.removeTask("task-only")).resolves.toBe(true);
    await expect(client.removeTask("task-and-files", { clean: true })).resolves.toBe(true);

    const taskOnly = new URLSearchParams(bodies[0]);
    const taskAndFiles = new URLSearchParams(bodies[1]);
    expect(taskOnly.get("hash")).toBe("task-only");
    expect(taskOnly.has("clean")).toBe(false);
    expect(taskAndFiles.get("hash")).toBe("task-and-files");
    expect(taskAndFiles.get("clean")).toBe("1");
  });

  it("adds multiple URLs as separate tasks with temp/move and per-URL results", async () => {
    const settings = createTestSettings();
    const client = createApiClient({ settings, fetchFn: fetch });

    const bodies: string[] = [];

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddUrl", async ({ request }) => {
        const body = await request.text();
        bodies.push(body);
        // Reject the second URL to verify per-URL outcome reporting.
        if (new URLSearchParams(body).get("url") === "http://b.example/2.zip") {
          return HttpResponse.json({ error: 1, reason: "rejected" });
        }
        return HttpResponse.json({ error: 0 });
      }),
    );

    const results = await client.addUrls(["http://a.example/1.zip", "http://b.example/2.zip"]);

    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
      const params = new URLSearchParams(body);
      expect(params.get("temp")).toBe("Download");
      expect(params.get("move")).toBe("Multimedia/Movies");
    }
    expect(results[0]).toEqual({ url: "http://a.example/1.zip", ok: true });
    expect(results[1].ok).toBe(false);
    expect(results[1].error).toContain("rejected");
  });

  it("fetches aggregated download-station status", async () => {
    const settings = createTestSettings();
    const client = createApiClient({ settings, fetchFn: fetch });

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/Status", () =>
        HttpResponse.json({
          error: 0,
          data: {
            active: 2,
            all: 6,
            bt: 6,
            completed: 4,
            down_rate: 1234,
            downloading: 2,
            inactive: 4,
            paused: 0,
            seeding: 0,
            stopped: 0,
            up_rate: 56,
            url: 0,
          },
        }),
      ),
    );

    const status = await client.getStatus();

    expect(status).toMatchObject({ active: 2, all: 6, down_rate: 1234, up_rate: 56, downloading: 2 });
  });

  it("throws on a success status response that omits the data block", async () => {
    const settings = createTestSettings();
    const client = createApiClient({ settings, fetchFn: fetch });

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      // Some DS builds answer {error:0} with no status block — must not return undefined.
      http.post("http://nas.local:8080/downloadstation/V4/Task/Status", () => HttpResponse.json({ error: 0 })),
    );

    await expect(client.getStatus()).rejects.toThrow(/no status data/i);
  });

  it("gets the file list of a multi-file torrent", async () => {
    const settings = createTestSettings();
    const client = createApiClient({ settings, fetchFn: fetch });

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/GetFile", () =>
        HttpResponse.json({
          error: 0,
          total: 1,
          data: [
            {
              hash: "ABC123",
              name: "Pack",
              files: [
                { no: 0, filename: "a.iso", size: 100, done: 1, priority: 1 },
                { no: 1, filename: "b.txt", size: 5, done: 1, priority: 1 },
              ],
            },
          ],
        }),
      ),
    );

    const files = await client.getTaskFiles("ABC123");
    expect(files).toHaveLength(2);
    expect(files[0]).toEqual({ no: 0, filename: "a.iso", size: 100, done: 1, priority: 1 });
  });

  it("sets per-file priority with one request per index and reports outcomes", async () => {
    const settings = createTestSettings();
    const client = createApiClient({ settings, fetchFn: fetch });

    const seen: { index: string | null; priority: string | null }[] = [];

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/SetFile", async ({ request }) => {
        const params = new URLSearchParams(await request.text());
        seen.push({ index: params.get("index"), priority: params.get("priority") });
        // Reject index 1 to exercise per-file error reporting.
        if (params.get("index") === "1") {
          return HttpResponse.json({ error: 16387, reason: "ABC123" });
        }
        return HttpResponse.json({ error: 0 });
      }),
    );

    const results = await client.setTaskFiles("ABC123", [
      { index: 0, priority: 1 },
      { index: 1, priority: 0 },
    ]);

    expect(seen).toEqual([
      { index: "0", priority: "1" },
      { index: "1", priority: "0" },
    ]);
    expect(results[0]).toEqual({ index: 0, ok: true });
    expect(results[1].ok).toBe(false);
  });

  it("lists NAS directories and forwards the requested path", async () => {
    const settings = createTestSettings();
    const client = createApiClient({ settings, fetchFn: fetch });

    let dirBody = "";

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Dir", async ({ request }) => {
        dirBody = await request.text();
        return HttpResponse.json({
          base_path: "Download",
          error: 0,
          total: 2,
          data: [
            { dir: "Movies", path: "Download/Movies", temporary: true, writtable: true },
            { dir: "ReadOnly", path: "Download/ReadOnly", temporary: false, writtable: false },
          ],
        });
      }),
    );

    const entries = await client.listDir("Download");

    expect(new URLSearchParams(dirBody).get("path")).toBe("Download");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ dir: "Movies", path: "Download/Movies", temporary: true, writtable: true });
    expect(entries[1].writtable).toBe(false);
  });

  it("throws a readable error when task query fails", async () => {
    const settings = createTestSettings();
    const client = createApiClient({ settings, fetchFn: fetch });

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/Query", () =>
        HttpResponse.json({ error: 24501, reason: "Permission denied" }),
      ),
    );

    await expect(client.queryTasksRaw()).rejects.toThrow(/Permission denied/);
  });

  it("reports duplicate torrent API errors from the stable multipart endpoint", async () => {
    const settings = createTestSettings();
    const client = createApiClient({ settings, fetchFn: fetch });

    let torrentBody = "";

    server.use(
      http.post("http://nas.local:8080/downloadstation/V4/Misc/Login", () =>
        HttpResponse.json({ error: 0, sid: "SID-QNAP", user: "admin" }),
      ),
      http.post("http://nas.local:8080/downloadstation/V4/Task/AddTorrent", async ({ request }) => {
        torrentBody = await request.text();
        return HttpResponse.json({ error: 24593, reason: "Duplicate task already exists" });
      }),
    );

    await expect(
      client.addTorrent(new File(["torrent-body"], "existing.torrent", { type: "application/x-bittorrent" })),
    ).resolves.toEqual({ added: false, duplicate: true });

    expect(torrentBody).toContain('name="sid"');
    expect(torrentBody).toContain("SID-QNAP");
    expect(torrentBody).toContain('name="temp"');
    expect(torrentBody).toContain("Download");
    expect(torrentBody).toContain('name="move"');
    expect(torrentBody).toContain("Multimedia/Movies");
    expect(torrentBody).toContain('name="dest_path"');
    expect(torrentBody).toContain('name="bt"');
    expect(torrentBody).toContain('name="bt_task"');
    // Paths must be relative — an absolute /share/... is rejected by DS (error 4096).
    expect(torrentBody).not.toContain("/share/");
  });
});
