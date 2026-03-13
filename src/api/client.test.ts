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
    expect(torrentBody).toContain("/share/Download");
    expect(torrentBody).toContain('name="move"');
    expect(torrentBody).toContain("/share/Multimedia/Movies");
    expect(torrentBody).toContain('name="dest_path"');
    expect(torrentBody).toContain('name="bt"');
    expect(torrentBody).toContain('name="bt_task"');
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
    expect(torrentBody).toContain("/share/Download");
    expect(torrentBody).toContain('name="move"');
    expect(torrentBody).toContain("/share/Multimedia/Movies");
    expect(torrentBody).toContain('name="dest_path"');
    expect(torrentBody).toContain('name="bt"');
    expect(torrentBody).toContain('name="bt_task"');
  });
});
