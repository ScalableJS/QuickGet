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

  setLoggerEnabled(value: boolean): void {
    if ("setEnabled" in this.logger) {
      this.logger.setEnabled(value);
    }
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

  async addUrl(
    url: string,
    options: { savePath?: string; tempFolder?: string; targetFolder?: string } = {},
  ): Promise<boolean> {
    // Build form data - API requires URLSearchParams format
    const requestBody = withEmptySid<AddUrlRequest>({
      url,
      savepath:
        options.savePath ??
        options.targetFolder ??
        (this.settings.NASdir ? this.settings.NASdir : `/${this.settings.NAStempdir}`),
      temp: options.tempFolder,
      move: options.targetFolder,
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
