import type { ApiResponse } from "./type.js";
import type { ClientSetupOptions, ApiFetchClient } from "./index.js";
import { createOpenApiFetchClient, buildNASBaseUrl } from "./index.js";
import type { Settings } from "../lib/config.js";
import { createLogger, Logger } from "../lib/logger.js";
import { normalizeTasks, type Task } from "../lib/tasks.js";
import { createApiError, isSuccessResponse, getErrorMessage } from "./utils.js";

export interface ApiClientOptions extends ClientSetupOptions {
  logger?: Logger;
}

type TaskQueryResponse = ApiResponse<"queryTasks">;

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

  constructor(options: ApiClientOptions) {
    this.settings = options.settings;
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

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/cgi-bin/authLogin.cgi`);
      return response.ok;
    } catch (error) {
      this.logger.error("NAS connection test failed", error);
      return false;
    }
  }

  async queryTasks(options: QueryTasksOptions = {}): Promise<QueryTasksResult> {
    const raw = await this.queryTasksRaw(options);
    const tasks = normalizeTasks("qnap", raw);
    return { raw, tasks };
  }

  async queryTasksRaw(options: QueryTasksOptions = {}): Promise<TaskQueryResponse> {
    const { params = {}, signal } = options;

    // Build form data - API requires URLSearchParams format
    const formData = new URLSearchParams();
    formData.append("limit", String(params.limit ?? 0));
    if (params.from !== undefined) {
      formData.append("from", String(params.from));
    }
    formData.append("field", params.field ?? "priority");
    formData.append("direction", params.direction ?? "DESC");
    formData.append("status", params.status ?? "all");
    formData.append("type", params.type ?? "all");

    const { data, error } = await this.client.POST("/downloadstation/V4/Task/Query", {
      body: formData as any,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
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
    options: { savePath?: string; tempFolder?: string; targetFolder?: string } = {}
  ): Promise<boolean> {
    // Build form data - API requires URLSearchParams format
    const formData = new URLSearchParams();
    formData.append("url", url);
    formData.append(
      "savepath",
      options.savePath ??
        options.targetFolder ??
        (this.settings.NASdir ? this.settings.NASdir : `/${this.settings.NAStempdir}`)
    );
    if (options.tempFolder) {
      formData.append("temp", options.tempFolder);
    }
    if (options.targetFolder) {
      formData.append("move", options.targetFolder);
    }

    const { data, error } = await this.client.POST("/downloadstation/V4/Task/AddUrl", {
      body: formData as any,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
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
    // Build FormData with torrent file
    const formData = new FormData();
    formData.append("bt", file, file.name);
    formData.append("bt_task", file, file.name);
    formData.append("temp", this.settings.NAStempdir);
    if (this.settings.NASdir) {
      formData.append("move", this.settings.NASdir);
      formData.append("dest_path", this.settings.NASdir);
    }

    // Send via openapi-fetch with FormData
    // Middleware will add SID automatically
    const { data, error } = await this.client.POST("/downloadstation/V4/Task/AddTorrent", {
      body: formData as any,
      bodySerializer: (body) => body, // Pass FormData as-is
    });

    const payload = data ?? error;

    if (isSuccessResponse(payload)) {
      return { added: true };
    }

    const err = createApiError("AddTorrent error", payload);
    if ((err as any).duplicate) {
      return { added: false, duplicate: true };
    }

    throw err;
  }

  async startTask(hash: string): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("hash", hash);

    const { data, error } = await this.client.POST("/downloadstation/V4/Task/Start", {
      body: formData as any,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
    });

    const payload = data ?? error;
    if (isSuccessResponse(payload)) {
      return true;
    }

    throw new Error(`Start task failed: ${getErrorMessage(payload)}`);
  }

  async stopTask(hash: string): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("hash", hash);

    const { data, error } = await this.client.POST("/downloadstation/V4/Task/Stop", {
      body: formData as any,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
    });

    const payload = data ?? error;
    if (isSuccessResponse(payload)) {
      return true;
    }

    throw new Error(`Stop task failed: ${getErrorMessage(payload)}`);
  }

  async removeTask(hash: string, options: { clean?: boolean } = {}): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("hash", hash);
    if (options.clean != null) {
      formData.append("clean", options.clean ? "1" : "0");
    }

    const { data, error } = await this.client.POST("/downloadstation/V4/Task/Remove", {
      body: formData as any,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
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
