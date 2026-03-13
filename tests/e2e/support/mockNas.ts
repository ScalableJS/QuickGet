import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import type { DownloadJob, DownloadJobsListResponse } from "@api/type.js";
import type { Task, TaskStatus } from "@lib/tasks.js";

import { RedactedHttpLog } from "./redactedHttpLog.js";

interface MockNasOptions {
  initialTasks?: Array<DownloadJob | Task>;
}

interface MockNasHandle {
  port: number;
  requestLog: RedactedHttpLog;
  close: () => Promise<void>;
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  response.end(text);
}

function readFormValue(rawBody: string, key: string): string | null {
  const params = new URLSearchParams(rawBody);
  const value = params.get(key);
  return value == null ? null : value;
}

function readMultipartField(rawBody: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`name="${escaped}"\\r?\\n\\r?\\n([\\s\\S]*?)\\r?\\n--`, "i").exec(rawBody);
  return match?.[1]?.trim() ?? null;
}

function readMultipartFilename(rawBody: string, fieldName: string): string | null {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`name="${escaped}"; filename="([^"]+)"`, "i").exec(rawBody);
  return match?.[1] ?? null;
}

function formatQnapDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours24 = value.getHours();
  const hours12 = hours24 % 12 || 12;
  const hours = String(hours12).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const seconds = String(value.getSeconds()).padStart(2, "0");
  const meridiem = hours24 >= 12 ? "pm" : "am";
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds} ${meridiem}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function sanitizePositiveInteger(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.round(value));
}

function mapUnifiedStatusToQnapState(status: TaskStatus): number {
  switch (status) {
    case "downloading":
      return 104;
    case "seeding":
      return 100;
    case "paused":
      return 3;
    case "stopped":
      return 102;
    case "checking":
    case "repairing":
      return 101;
    case "extracting":
    case "finishing":
      return 103;
    case "finished":
      return 5;
    case "error":
      return 4;
    default:
      return 0;
  }
}

function isUnifiedTask(input: DownloadJob | Task): input is Task {
  return "status" in input || "sizeBytes" in input || "downSpeedBps" in input;
}

function toRawQnapJob(input: DownloadJob | Task, index: number): DownloadJob {
  if (!isUnifiedTask(input)) {
    const fallbackName = input.source_name || input.source || `Task ${index}`;
    const fallback = createTask(fallbackName, index);
    return {
      ...fallback,
      ...input,
      hash: input.hash || fallback.hash,
      path: input.path || fallback.path,
      source: input.source || input.source_name || fallback.source,
      source_name: input.source_name || input.source || fallback.source_name,
    };
  }

  const name = input.name || `Task ${index}`;
  const createdAt = new Date(input.addedAt ?? Date.UTC(2026, 2, 12, 11, 26, 55 + index));
  const createdAtText = formatQnapDate(createdAt);
  const progress = clamp(sanitizePositiveInteger(input.progress, 0), 0, 100);
  const size = sanitizePositiveInteger(input.sizeBytes, 0);
  const totalDown = sanitizePositiveInteger(input.downloadedBytes, 0);
  const totalUp = sanitizePositiveInteger(input.uploadedBytes, 0);
  const downRate = sanitizePositiveInteger(input.downSpeedBps, input.status === "downloading" ? 1024 : 0);
  const upRate = sanitizePositiveInteger(input.upSpeedBps, input.status === "seeding" ? 64 : 0);
  const state = mapUnifiedStatusToQnapState(input.status);
  const isActive =
    input.status === "downloading" ||
    input.status === "seeding" ||
    input.status === "checking" ||
    input.status === "repairing" ||
    input.status === "extracting" ||
    input.status === "finishing";

  return {
    activity_time: isActive && (progress > 0 || downRate > 0 || upRate > 0) ? 60 : 0,
    caller: "Download Station",
    caller_meta: "",
    category: 1,
    choose_files: 1,
    comment: "",
    create_time: createdAtText,
    done: totalDown,
    down_rate: downRate,
    down_size: totalDown,
    error: input.status === "error" ? 1 : 0,
    eta: input.etaSec ?? (input.status === "finished" ? 0 : -1),
    finish_time: input.status === "finished" ? createdAtText : "",
    hash: input.hash ?? `hash-${index}`,
    move: "Movies",
    path: `/Download/${name}`,
    peers: sanitizePositiveInteger(input.peers?.connected ?? 0, 0),
    priority: sanitizePositiveInteger(input.priority ?? 0, 0),
    progress,
    seeds: sanitizePositiveInteger(input.seeds?.connected ?? 0, 0),
    share: 0,
    size,
    source: name,
    source_name: name,
    start_time: createdAtText,
    state,
    temp: "Download",
    total_down: totalDown,
    total_files: 1,
    total_up: totalUp,
    type: "BT",
    uid: 0,
    up_rate: upRate,
    up_size: totalUp,
    username: "admin",
    wakeup_time: "",
  };
}

function createTask(name: string, index: number): DownloadJob {
  return toRawQnapJob(
    {
      id: `hash-${index}`,
      name,
      status: "downloading",
      progress: 42,
      sizeBytes: 1000,
      downloadedBytes: 420,
      uploadedBytes: 12,
      downSpeedBps: 1024,
      upSpeedBps: 64,
      etaSec: 120,
      hash: `hash-${index}`,
      priority: 0,
      seeds: { connected: 12 },
      peers: { connected: 4 },
      source: "qnap",
    },
    index,
  );
}

function buildQueryStatus(tasks: DownloadJob[]): DownloadJobsListResponse["status"] {
  const active = tasks.filter((task) => task.activity_time > 0 || task.down_rate > 0 || task.up_rate > 0).length;
  const downloading = tasks.filter((task) => [2, 6, 104].includes(task.state)).length;
  const paused = tasks.filter((task) => task.state === 3 || (task.state === 1 && task.progress > 0)).length;
  const seeding = tasks.filter((task) => [100, 105].includes(task.state)).length;
  const completed = tasks.filter((task) => task.state === 5 || task.progress >= 100).length;
  const stopped = tasks.filter(
    (task) =>
      task.state === 102 ||
      ([2, 6, 104].includes(task.state) &&
        task.activity_time === 0 &&
        task.down_rate === 0 &&
        task.up_rate === 0 &&
        task.progress < 100),
  ).length;

  return {
    active,
    all: tasks.length,
    bt: tasks.filter((task) => task.type === "BT").length,
    completed,
    down_rate: tasks.reduce((sum, task) => sum + task.down_rate, 0),
    downloading,
    inactive: Math.max(tasks.length - active, 0),
    paused,
    seeding,
    stopped,
    up_rate: tasks.reduce((sum, task) => sum + task.up_rate, 0),
    url: tasks.filter((task) => task.type === "HTTP" || task.type === "FTP").length,
  };
}

function buildTaskQueryResponse(tasks: DownloadJob[], rawBody: string): DownloadJobsListResponse {
  const from = Math.max(Number(readFormValue(rawBody, "from") ?? 0) || 0, 0);
  const limit = Math.max(Number(readFormValue(rawBody, "limit") ?? 0) || 0, 0);
  const data = limit > 0 ? tasks.slice(from, from + limit) : tasks.slice(from);

  return {
    error: 0,
    data,
    status: buildQueryStatus(tasks),
    total: tasks.length,
  };
}

export async function startMockNas(options: MockNasOptions = {}): Promise<MockNasHandle> {
  const requestLog = new RedactedHttpLog();
  const tasks = (options.initialTasks ?? [createTask("Ubuntu ISO", 1)]).map((task, index) =>
    toRawQnapJob(task, index + 1),
  );

  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    const method = request.method ?? "GET";
    const body = await readRequestBody(request);

    const reply = (status: number, payload: unknown): void => {
      requestLog.add({
        method,
        path,
        status,
        requestBody: body,
        responseBody: JSON.stringify(payload),
      });
      sendJson(response, status, payload);
    };

    if (path === "/downloadstation/V4/Misc/Login" && method === "POST") {
      reply(200, {
        admin: 1,
        error: 0,
        privilege: 1,
        sid: "E2E-SID-123",
        token: "E2E-TOKEN-123",
        user: "admin",
      });
      return;
    }

    if (path === "/downloadstation/V4/Task/Query" && method === "POST") {
      reply(200, buildTaskQueryResponse(tasks, body));
      return;
    }

    if (path === "/downloadstation/V4/Task/Start" && method === "POST") {
      const hash = readFormValue(body, "hash");
      const task = tasks.find((item) => item.hash === hash);
      if (task) {
        task.state = task.progress >= 100 ? 100 : 104;
        task.activity_time = 60;
        task.down_rate = task.progress >= 100 ? 0 : Math.max(task.down_rate, 1024);
        task.up_rate = Math.max(task.up_rate, 64);
        task.eta = task.progress >= 100 ? 0 : Math.max(task.eta, 0);
      }
      reply(200, { error: 0 });
      return;
    }

    if (path === "/downloadstation/V4/Task/Stop" && method === "POST") {
      const hash = readFormValue(body, "hash");
      const task = tasks.find((item) => item.hash === hash);
      if (task) {
        task.state = 102;
        task.activity_time = 0;
        task.down_rate = 0;
        task.up_rate = 0;
        task.eta = -1;
      }
      reply(200, { error: 0 });
      return;
    }

    if (path === "/downloadstation/V4/Task/Pause" && method === "POST") {
      const hash = readFormValue(body, "hash");
      const task = tasks.find((item) => item.hash === hash);
      if (task) {
        task.state = 3;
        task.activity_time = 0;
        task.down_rate = 0;
        task.up_rate = 0;
      }
      reply(200, { error: 0 });
      return;
    }

    if (path === "/downloadstation/V4/Task/Remove" && method === "POST") {
      const hash = readFormValue(body, "hash");
      const index = tasks.findIndex((item) => item.hash === hash);
      if (index >= 0) tasks.splice(index, 1);
      reply(200, { error: 0 });
      return;
    }

    if (
      [
        "/downloadstation/V4/Task/AddTorrent",
        "/downloadstation/V4/Task/AddTask",
        "/downloadstation/V4/Task/Add",
      ].includes(path) &&
      method === "POST"
    ) {
      const fileName =
        readMultipartFilename(body, "bt") ??
        readMultipartFilename(body, "bt_task") ??
        readMultipartFilename(body, "file") ??
        "uploaded.torrent";
      const normalizedName = fileName.replace(/\.torrent$/i, "") || "uploaded";
      const duplicate = tasks.some((item) => item.source_name.toLowerCase() === normalizedName.toLowerCase());

      const sid = readMultipartField(body, "sid");
      if (!sid) {
        reply(400, { error: 1001, reason: "Missing sid" });
        return;
      }

      if (duplicate) {
        reply(200, { error: 24593, reason: "Duplicate task already exists" });
        return;
      }

      const nextIndex = tasks.length + 1;
      const task = toRawQnapJob(
        {
          id: `hash-${nextIndex}`,
          name: normalizedName,
          status: "downloading",
          progress: 0,
          sizeBytes: 0,
          downloadedBytes: 0,
          uploadedBytes: 0,
          downSpeedBps: 0,
          upSpeedBps: 0,
          etaSec: 0,
          hash: `hash-${nextIndex}`,
          priority: 1,
          seeds: { connected: 0 },
          peers: { connected: 0 },
          source: "qnap",
        },
        nextIndex,
      );
      task.move = readMultipartField(body, "move") ?? "Movies";
      task.path = `/Download/@DownloadStationTempFiles/admin/${normalizedName}.${task.hash}`;
      task.source = normalizedName;
      task.source_name = normalizedName;
      task.state = 104;
      task.temp = readMultipartField(body, "temp") ?? "Download";
      tasks.push(task);
      reply(200, { error: 0 });
      return;
    }

    reply(404, { error: 404, reason: `Unhandled route: ${method} ${path}` });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine mock NAS port");
  }

  return {
    port: address.port,
    requestLog,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
