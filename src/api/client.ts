import type { Settings } from "@lib/config.js";
import { createLogger, type Logger } from "@lib/logger.js";
import { normalizeTasks, type Task } from "@lib/tasks.js";
import type { ApiFetchClient, ClientSetupOptions } from ".";
import { buildNASBaseUrl, createOpenApiFetchClient, performLogin } from ".";
import type { ApiResponse, components } from "./type.js";
import { createApiError, getErrorMessage, isSuccessResponse } from "./utils.js";

export interface ApiClientOptions extends ClientSetupOptions {
  logger?: Logger;
}

type TaskQueryResponse = ApiResponse<"queryTasks">;
type TaskQueryRequest = components["schemas"]["TaskQueryRequest"];
type AddUrlRequest = components["schemas"]["AddUrlRequest"];
type ModifyTaskRequest = components["schemas"]["ModifyTaskRequest"];
type RemoveTaskRequest = components["schemas"]["RemoveTaskRequest"];
type DirListRequest = components["schemas"]["DirListRequest"];
export type DirEntry = components["schemas"]["DirEntry"];
type StatusRequest = components["schemas"]["StatusRequest"];
export type DownloadStationStatus = components["schemas"]["DownloadStationStatus"];
type GetFileRequest = components["schemas"]["GetFileRequest"];
type SetFileRequest = components["schemas"]["SetFileRequest"];
export type TorrentFile = components["schemas"]["TorrentFile"];

export interface QueryTasksResult {
  raw: TaskQueryResponse;
  tasks: Task[];
}

export interface QueryTasksParams {
  limit?: number;
  from?: number;
  field?: string;
  direction?: "ASC" | "DESC";
  status?: string;
  type?: string;
}

export interface QueryTasksOptions {
  params?: QueryTasksParams;
  signal?: AbortSignal;
}

export interface AddTorrentResult {
  added: boolean;
  duplicate?: boolean;
}

/**
 * Simplified API client using openapi-fetch with SID middleware
 */
export class ApiClient {
  private readonly settings: Settings;
  private readonly logger: Logger;
  private readonly client: ApiFetchClient;
  private readonly fetchFn: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.settings = options.settings;
    this.fetchFn = (input, init) => {
      const fetchImpl = options.fetchFn ?? fetch;
      return fetchImpl(input, init);
    };
    this.logger =
      options.logger ??
      createLogger("ApiClient", {
        enabled: false,
      });
    this.client = createOpenApiFetchClient({
      settings: options.settings,
      fetchFn: options.fetchFn,
      logger: {
        error: (msg, err) => this.logger.error(msg, err),
        debug: (msg, data) => this.logger.debug(msg, data),
      },
    });
  }

  get baseUrl(): string {
    return buildNASBaseUrl(this.settings);
  }

  async queryTasks(options: QueryTasksOptions = {}): Promise<QueryTasksResult> {
    const raw = await this.queryTasksRaw(options);
    const tasks = normalizeTasks("qnap", raw);
    return { raw, tasks };
  }

  async queryTasksRaw(options: QueryTasksOptions = {}): Promise<TaskQueryResponse> {
    const { params = {}, signal } = options;

    const requestBody = withEmptySid<TaskQueryRequest>({
      limit: params.limit ?? 0,
      from: params.from,
      field: params.field ?? "priority",
      direction: params.direction ?? "DESC",
      status: params.status ?? "all",
      type: params.type ?? "all",
    });

    const { data, error } = await this.client.POST("/downloadstation/V4/Task/Query", {
      body: requestBody,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      bodySerializer: serializeUrlEncoded,
      signal,
    });

    if (error) {
      throw new Error(`Task query failed: ${getErrorMessage(error)}`);
    }

    if (!data) {
      throw new Error("Task query failed: no response data");
    }

    if (!isSuccessResponse(data)) {
      throw new Error(`Task query failed: ${getErrorMessage(data)}`);
    }

    return data;
  }

  async addUrl(url: string, options: { tempFolder?: string; targetFolder?: string } = {}): Promise<boolean> {
    // QNAP DS V4 AddUrl requires BOTH `temp` and `move`; omitting either is rejected
    // (`{"error":1,"reason":"temp"}` / `"move"`). The `savepath` field does not exist
    // in the API and is silently ignored, so we always send temp/move from settings.
    const requestBody = withEmptySid<AddUrlRequest>({
      url,
      temp: options.tempFolder ?? this.settings.NAStempdir,
      move: options.targetFolder ?? this.settings.NASdir,
    });

    const { data, error } = await this.client.POST("/downloadstation/V4/Task/AddUrl", {
      body: requestBody,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      bodySerializer: serializeUrlEncoded,
    });

    if (error) {
      throw new Error(`Add URL failed: ${getErrorMessage(error)}`);
    }

    if (!data || !isSuccessResponse(data)) {
      throw new Error(`Add URL failed: ${getErrorMessage(data)}`);
    }

    return true;
  }

  async addTorrent(file: File): Promise<AddTorrentResult> {
    const loginResult = await performLogin(this.settings);

    const formData = new FormData();
    formData.append("sid", loginResult.sid);
    formData.append("bt", file);
    formData.append("bt_task", file);
    formData.append("temp", this.settings.NAStempdir);

    if (this.settings.NASdir) {
      formData.append("move", this.settings.NASdir);
      formData.append("dest_path", this.settings.NASdir);
    }

    const response = await this.fetchFn(`${this.baseUrl}/downloadstation/V4/Task/AddTorrent`, {
      method: "POST",
      body: formData,
    });

    let payload: unknown;

    try {
      payload = await response.clone().json();
    } catch {
      const rawText = await response
        .clone()
        .text()
        .catch(() => "");
      payload = response.ok ? { error: 0 } : { error: response.status || -1, reason: rawText || response.statusText };
    }

    if (isSuccessResponse(payload)) {
      return { added: true };
    }

    const err = createApiError("AddTorrent error", payload);
    if (isErrorWithDuplicateFlag(err) && err.duplicate) {
      return { added: false, duplicate: true };
    }

    throw err;
  }

  async startTask(hash: string): Promise<boolean> {
    const body = withEmptySid<ModifyTaskRequest>({ hash });
    const { data, error } = await this.client.POST("/downloadstation/V4/Task/Start", {
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      bodySerializer: serializeUrlEncoded,
    });

    const payload = data ?? error;
    if (isSuccessResponse(payload)) {
      return true;
    }

    throw new Error(`Start task failed: ${getErrorMessage(payload)}`);
  }

  async stopTask(hash: string): Promise<boolean> {
    const body = withEmptySid<ModifyTaskRequest>({ hash });
    const { data, error } = await this.client.POST("/downloadstation/V4/Task/Stop", {
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      bodySerializer: serializeUrlEncoded,
    });

    const payload = data ?? error;
    if (isSuccessResponse(payload)) {
      return true;
    }

    throw new Error(`Stop task failed: ${getErrorMessage(payload)}`);
  }

  async pauseTask(hash: string): Promise<boolean> {
    const body = withEmptySid<ModifyTaskRequest>({ hash });
    const { data, error } = await this.client.POST("/downloadstation/V4/Task/Pause", {
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      bodySerializer: serializeUrlEncoded,
    });

    const payload = data ?? error;
    if (isSuccessResponse(payload)) {
      return true;
    }

    throw new Error(`Pause task failed: ${getErrorMessage(payload)}`);
  }

  async removeTask(hash: string, options: { clean?: boolean } = {}): Promise<boolean> {
    const body = withEmptySid<RemoveTaskRequest>({
      hash,
      clean: options.clean != null ? (options.clean ? 1 : 0) : undefined,
    });
    const { data, error } = await this.client.POST("/downloadstation/V4/Task/Remove", {
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      bodySerializer: serializeUrlEncoded,
    });

    const payload = data ?? error;
    if (isSuccessResponse(payload)) {
      return true;
    }

    throw new Error(`Remove task failed: ${getErrorMessage(payload)}`);
  }

  /**
   * Add several URLs as independent tasks. Each URL is sent through `addUrl`
   * (reusing the required temp/move handling), so the per-URL outcome is known.
   */
  async addUrls(
    urls: string[],
    options: { tempFolder?: string; targetFolder?: string } = {},
  ): Promise<{ url: string; ok: boolean; error?: string }[]> {
    const settled = await Promise.allSettled(urls.map((url) => this.addUrl(url, options)));
    return settled.map((result, i) => {
      const url = urls[i];
      if (result.status === "fulfilled") {
        return { url, ok: result.value };
      }
      const reason = result.reason;
      return { url, ok: false, error: reason instanceof Error ? reason.message : String(reason) };
    });
  }

  /**
   * Fetch aggregated Download Station stats without pulling the task array —
   * cheaper than queryTasks for background badge polling.
   */
  async getStatus(): Promise<DownloadStationStatus> {
    const body = withEmptySid<StatusRequest>({});
    const { data, error } = await this.client.POST("/downloadstation/V4/Task/Status", {
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      bodySerializer: serializeUrlEncoded,
    });

    const payload = data ?? error;
    if (!data || !isSuccessResponse(payload)) {
      throw new Error(`Get status failed: ${getErrorMessage(payload)}`);
    }

    return data.data;
  }

  /** List the files inside a (multi-file) torrent task. */
  async getTaskFiles(hash: string): Promise<TorrentFile[]> {
    const body = withEmptySid<GetFileRequest>({ hash });
    const { data, error } = await this.client.POST("/downloadstation/V4/Task/GetFile", {
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      bodySerializer: serializeUrlEncoded,
    });

    const payload = data ?? error;
    if (!data || !isSuccessResponse(payload)) {
      throw new Error(`Get task files failed: ${getErrorMessage(payload)}`);
    }

    return data.data[0]?.files ?? [];
  }

  /**
   * Set per-file download priority. The API takes one file per call
   * (`index` + `priority`), so selections are applied with Promise.allSettled.
   * Note: only works while the task is active — completed tasks reject (error 16387).
   */
  async setTaskFiles(
    hash: string,
    selections: { index: number; priority: 0 | 1 }[],
  ): Promise<{ index: number; ok: boolean; error?: string }[]> {
    const settled = await Promise.allSettled(
      selections.map(({ index, priority }) => this.setTaskFile(hash, index, priority)),
    );
    return settled.map((result, i) => {
      const { index } = selections[i];
      if (result.status === "fulfilled") {
        return { index, ok: true };
      }
      const reason = result.reason;
      return { index, ok: false, error: reason instanceof Error ? reason.message : String(reason) };
    });
  }

  private async setTaskFile(hash: string, index: number, priority: 0 | 1): Promise<boolean> {
    const body = withEmptySid<SetFileRequest>({ hash, index, priority });
    const { data, error } = await this.client.POST("/downloadstation/V4/Task/SetFile", {
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      bodySerializer: serializeUrlEncoded,
    });

    const payload = data ?? error;
    if (isSuccessResponse(payload)) {
      return true;
    }

    throw new Error(`Set file failed: ${getErrorMessage(payload)}`);
  }

  async listDir(path = ""): Promise<DirEntry[]> {
    const body = withEmptySid<DirListRequest>({ path });
    const { data, error } = await this.client.POST("/downloadstation/V4/Misc/Dir", {
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      bodySerializer: serializeUrlEncoded,
    });

    const payload = data ?? error;
    if (!data || !isSuccessResponse(payload)) {
      throw new Error(`List dir failed: ${getErrorMessage(payload)}`);
    }

    return data.data;
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}

function withEmptySid<T extends { sid: string }>(body: Omit<T, "sid"> & Partial<Pick<T, "sid">>): T {
  return { sid: "", ...body } as T;
}

function serializeUrlEncoded<T extends { sid: string }>(body: T): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    if (key === "sid" && value === "") continue;
    params.append(key, String(value));
  }
  return params;
}

function isErrorWithDuplicateFlag(error: unknown): error is Error & { duplicate?: boolean } {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as { duplicate?: unknown };
  return typeof candidate.duplicate === "boolean";
}
