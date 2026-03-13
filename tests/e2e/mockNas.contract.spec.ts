import { expect, test } from "@playwright/test";

import type { DownloadJob, DownloadJobsListResponse } from "../../src/api/type.js";
import type { Task } from "../../src/lib/tasks.js";

import { startMockNas } from "./support/mockNas.js";

function createUnifiedTask(name: string, status: Task["status"], overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? `${name.toLowerCase().replace(/\s+/g, "-")}-${status}`,
    name,
    status,
    progress: overrides.progress ?? 0,
    sizeBytes: overrides.sizeBytes ?? 1_000,
    downloadedBytes: overrides.downloadedBytes ?? 0,
    uploadedBytes: overrides.uploadedBytes ?? 0,
    downSpeedBps: overrides.downSpeedBps ?? 0,
    upSpeedBps: overrides.upSpeedBps ?? 0,
    etaSec: overrides.etaSec,
    hash: overrides.hash ?? `hash-${name.toLowerCase().replace(/\s+/g, "-")}`,
    addedAt: overrides.addedAt,
    priority: overrides.priority ?? 0,
    seeds: overrides.seeds,
    peers: overrides.peers,
    source: overrides.source ?? "qnap",
  };
}

async function postJson<T>(baseUrl: string, path: string, body: URLSearchParams | FormData): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    body,
  });

  return (await response.json()) as T;
}

test("mock NAS returns richer login payload and paged Task/Query response", async () => {
  const initialTasks: Task[] = [
    createUnifiedTask("Ubuntu ISO", "downloading", {
      progress: 42,
      downloadedBytes: 420,
      uploadedBytes: 12,
      downSpeedBps: 1_024,
      upSpeedBps: 64,
      etaSec: 120,
      peers: { connected: 4 },
      seeds: { connected: 12 },
      priority: 2,
      hash: "hash-downloading",
    }),
    createUnifiedTask("Fedora ISO", "paused", {
      progress: 55,
      downloadedBytes: 550,
      downSpeedBps: 0,
      upSpeedBps: 0,
      hash: "hash-paused",
    }),
    createUnifiedTask("Arch Linux", "seeding", {
      progress: 100,
      downloadedBytes: 1_000,
      uploadedBytes: 250,
      downSpeedBps: 0,
      upSpeedBps: 256,
      seeds: { connected: 6 },
      peers: { connected: 2 },
      hash: "hash-seeding",
    }),
    createUnifiedTask("Debian ISO", "finished", {
      progress: 100,
      downloadedBytes: 1_000,
      uploadedBytes: 10,
      downSpeedBps: 0,
      upSpeedBps: 0,
      hash: "hash-finished",
    }),
    createUnifiedTask("OpenSUSE ISO", "stopped", {
      progress: 20,
      downloadedBytes: 200,
      downSpeedBps: 0,
      upSpeedBps: 0,
      hash: "hash-stopped",
    }),
  ];

  const mockNas = await startMockNas({ initialTasks });
  const baseUrl = `http://127.0.0.1:${mockNas.port}`;

  try {
    const login = await postJson<Record<string, unknown>>(
      baseUrl,
      "/downloadstation/V4/Misc/Login",
      new URLSearchParams({ user: "admin", pass: "secret" }),
    );

    expect(login).toMatchObject({
      error: 0,
      admin: 1,
      privilege: 1,
      sid: "E2E-SID-123",
      token: "E2E-TOKEN-123",
      user: "admin",
    });

    const query = await postJson<DownloadJobsListResponse>(
      baseUrl,
      "/downloadstation/V4/Task/Query",
      new URLSearchParams({
        sid: "E2E-SID-123",
        limit: "2",
        from: "1",
        field: "priority",
        direction: "DESC",
        status: "all",
        type: "all",
      }),
    );

    expect(query.error).toBe(0);
    expect(query.total).toBe(5);
    expect(query.data).toHaveLength(2);
    expect(query.data.map((task) => task.hash)).toEqual(["hash-paused", "hash-seeding"]);
    expect(query.status).toMatchObject({
      all: 5,
      active: 2,
      downloading: 1,
      paused: 1,
      seeding: 1,
      stopped: 1,
      bt: 5,
      url: 0,
    });
    expect(query.status.down_rate).toBe(1_024);
    expect(query.status.up_rate).toBe(320);

    expect(query.data[0]).toMatchObject({
      hash: "hash-paused",
      source_name: "Fedora ISO",
      state: 3,
      total_down: 550,
      down_rate: 0,
      up_rate: 0,
      move: "Movies",
      temp: "Download",
      type: "BT",
    });

    expect(query.data[1]).toMatchObject({
      hash: "hash-seeding",
      source_name: "Arch Linux",
      state: 100,
      total_down: 1_000,
      total_up: 250,
      up_rate: 256,
      peers: 2,
      seeds: 6,
    });
  } finally {
    await mockNas.close();
  }
});

test("mock NAS upload flow returns real-like added jobs and duplicate/missing sid errors", async () => {
  const initialTasks: DownloadJob[] = [
    {
      activity_time: 0,
      caller: "Download Station",
      caller_meta: "",
      category: 1,
      choose_files: 1,
      comment: "",
      create_time: "2026/03/12 11:25:47 am",
      done: 0,
      down_rate: 0,
      down_size: 0,
      error: 0,
      eta: -1,
      finish_time: "",
      hash: "hash-existing",
      move: "Movies",
      path: "/Download/existing",
      peers: 0,
      priority: 1,
      progress: 0,
      seeds: 0,
      share: 0,
      size: 0,
      source: "existing",
      source_name: "existing",
      start_time: "2026/03/12 11:25:47 am",
      state: 104,
      temp: "Download",
      total_down: 0,
      total_files: 1,
      total_up: 0,
      type: "BT",
      uid: 0,
      up_rate: 0,
      up_size: 0,
      username: "admin",
      wakeup_time: "",
    },
  ];

  const mockNas = await startMockNas({ initialTasks });
  const baseUrl = `http://127.0.0.1:${mockNas.port}`;

  try {
    const missingSidForm = new FormData();
    missingSidForm.append("bt", new File(["torrent-body"], "sample.torrent", { type: "application/x-bittorrent" }));

    const missingSidResponse = await fetch(`${baseUrl}/downloadstation/V4/Task/AddTorrent`, {
      method: "POST",
      body: missingSidForm,
    });

    expect(missingSidResponse.status).toBe(400);
    await expect(missingSidResponse.json()).resolves.toMatchObject({
      error: 1001,
      reason: "Missing sid",
    });

    const addForm = new FormData();
    addForm.append("sid", "E2E-SID-123");
    addForm.append("temp", "Download");
    addForm.append("move", "Movies");
    addForm.append("dest_path", "Movies");
    addForm.append("bt", new File(["torrent-body"], "sample.torrent", { type: "application/x-bittorrent" }));
    addForm.append("bt_task", new File(["torrent-body"], "sample.torrent", { type: "application/x-bittorrent" }));

    const addPayload = await postJson<{ error: number }>(baseUrl, "/downloadstation/V4/Task/AddTorrent", addForm);

    expect(addPayload).toEqual({ error: 0 });

    const queried = await postJson<DownloadJobsListResponse>(
      baseUrl,
      "/downloadstation/V4/Task/Query",
      new URLSearchParams({ sid: "E2E-SID-123", status: "all", type: "all" }),
    );

    const uploaded = queried.data.find((task) => task.source_name === "sample");
    expect(uploaded).toBeDefined();
    expect(uploaded).toMatchObject({
      state: 104,
      priority: 1,
      move: "Movies",
      temp: "Download",
      source: "sample",
      source_name: "sample",
      path: expect.stringContaining("/Download/@DownloadStationTempFiles/admin/sample.hash-2"),
      total_down: 0,
      total_up: 0,
      down_rate: 0,
      up_rate: 0,
      total_files: 1,
      type: "BT",
    });

    const duplicateForm = new FormData();
    duplicateForm.append("sid", "E2E-SID-123");
    duplicateForm.append("bt", new File(["torrent-body"], "sample.torrent", { type: "application/x-bittorrent" }));

    const duplicatePayload = await postJson<{ error: number; reason: string }>(
      baseUrl,
      "/downloadstation/V4/Task/AddTask",
      duplicateForm,
    );

    expect(duplicatePayload).toMatchObject({
      error: 24593,
      reason: "Duplicate task already exists",
    });
  } finally {
    await mockNas.close();
  }
});
