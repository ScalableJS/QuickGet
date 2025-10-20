import type { Settings } from "./config.js";
import { API_ENDPOINTS } from "./config.js";
import { createLogger, Logger } from "./logger.js";
import { normalizeTasks, type Task } from "./tasks.js";

export interface ApiClientOptions {
  settings: Settings;
  fetchFn?: typeof fetch;
  logger?: Logger;
}

export interface QueryTasksResult {
  raw: any;
  tasks: Task[];
}

export interface AddTorrentResult {
  added: boolean;
  duplicate?: boolean;
  unsupported?: boolean;
}

const RETRY_DELAYS = [0, 200, 400];

export function buildNASBaseUrl(settings: Settings): string {
  const protocol = settings.NASsecure ? "https" : "http";
  const address = String(settings.NASaddress || "").trim();

  if (!address) {
    throw new Error("NAS address is empty. Please set NAS Address in settings.");
  }

  const port = String(settings.NASport || "").trim();
  if (port && !/^\d+$/.test(port)) {
    throw new Error("Invalid NAS port. It must be numeric or left empty.");
  }

  const hostPort = port ? `${address}:${port}` : address;
  return `${protocol}://${hostPort}`;
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ApiClient {
  private readonly settings: Settings;
  private readonly fetchFn: typeof fetch;
  private readonly logger: Logger;
  private sid: string | null = null;

  constructor(options: ApiClientOptions) {
    this.settings = options.settings;
    const fetchImpl = options.fetchFn ?? fetch;
    this.fetchFn = ((input, init) => fetchImpl(input, init)) as typeof fetch;
    this.logger =
      options.logger ??
      createLogger("ApiClient", {
        enabled: false,
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

  setSid(sid: string | null): void {
    this.sid = sid;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.fetchFn(`${this.baseUrl}${API_ENDPOINTS.AUTH_PROBE}`);
      return response.ok;
    } catch (error) {
      this.logger.error("NAS connection test failed", error);
      return false;
    }
  }

  async login(force = false): Promise<string> {
    if (this.sid && !force) return this.sid;

    const formData = new URLSearchParams();
    formData.append("user", this.settings.NASlogin);
    formData.append("pass", btoa(this.settings.NASpassword));

    const response = await this.fetchFn(`${this.baseUrl}${API_ENDPOINTS.LOGIN}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`NAS login failed: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    let data: any;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else if (contentType.includes("text/xml") || contentType.includes("application/xml")) {
      const text = await response.text();
      data = xmlToJSON(text);
    } else {
      const text = await response.text();
      data = JSON.parse(text);
    }

    if (data?.sid) {
      this.sid = String(data.sid);
      this.logger.debug("Login successful", this.sid);
      return this.sid;
    }

    throw new Error("NAS login failed: no SID in response");
  }

  async queryTasks(options: { signal?: AbortSignal } = {}): Promise<QueryTasksResult> {
    const raw = await this.queryTasksRaw(options);
    const tasks = normalizeTasks("qnap", raw);
    return { raw, tasks };
  }

  async queryTasksRaw(options: { signal?: AbortSignal } = {}): Promise<any> {
    const sid = await this.ensureSid();

    const formData = new URLSearchParams();
    formData.append("sid", sid);
    formData.append("limit", "0");
    formData.append("status", "all");
    formData.append("type", "all");

    const response = await this.postForm(API_ENDPOINTS.TASK_QUERY, formData, {
      label: "TaskQuery",
      signal: options.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }

    const text = await response.text();
    if (contentType.includes("application/xml") || contentType.includes("text/xml")) {
      return xmlToJSON(text);
    }

    return JSON.parse(text);
  }

  async addUrl(url: string): Promise<boolean> {
    const sid = await this.ensureSid();
    const formData = new URLSearchParams();
    formData.append("sid", sid);
    formData.append("url", url);
    formData.append("savepath", `/${this.settings.NAStempdir}`);

    const response = await this.postForm(API_ENDPOINTS.TASK_ADD_URL, formData, {
      label: "AddUrl",
    });

    if (!response.ok) {
      throw new Error(`Add URL failed: ${response.statusText}`);
    }

    return true;
  }

  async addTorrent(file: File): Promise<AddTorrentResult> {
    const sid = await this.ensureSid();
    const formFactory = () => {
      const formData = new FormData();
      formData.append("sid", sid);
      formData.append("temp", this.settings.NAStempdir);
      if (this.settings.NASdir) {
        formData.append("move", this.settings.NASdir);
        formData.append("dest_path", this.settings.NASdir);
      }
      return formData;
    };

    const attempts: Array<() => Promise<Response>> = [
      () => {
        const form = formFactory();
        form.append("bt", file, file.name);
        form.append("bt_task", file, file.name);
        return this.postForm(API_ENDPOINTS.TASK_ADD_TORRENT, form, { label: "AddTorrent" });
      },
      () => {
        const form = formFactory();
        form.append("file", file, file.name);
        form.append("bt", file, file.name);
        form.append("bt_task", file, file.name);
        return this.postForm(API_ENDPOINTS.TASK_ADD_TASK, form, { label: "AddTask" });
      },
      () => {
        const form = formFactory();
        form.append("bt", file, file.name);
        form.append("bt_task", file, file.name);
        return this.postForm(API_ENDPOINTS.TASK_ADD, form, { label: "AddLegacy" });
      },
    ];

    let lastError: any = null;

    for (let i = 0; i < attempts.length; i += 1) {
      try {
        await delay(RETRY_DELAYS[i] ?? 0);
        const response = await attempts[i]();
        const payload = await this.parseJsonSafe(response);
        const errorCode = Number(payload?.error ?? -1);

        if (errorCode === 0) {
          return { added: true };
        }

        const error = createTorrentError("AddTorrent error", payload);
        if ((error as any).duplicate) {
          return { added: false, duplicate: true };
        }
        if ((error as any).apiUnsupported && i < attempts.length - 1) {
          lastError = error;
          continue;
        }
        throw error;
      } catch (error) {
        lastError = error;
        if ((error as any)?.duplicate) {
          return { added: false, duplicate: true };
        }
        if ((error as any)?.apiUnsupported && i < attempts.length - 1) {
          continue;
        }
        throw error;
      }
    }

    if ((lastError as any)?.apiUnsupported) {
      return { added: false, unsupported: true };
    }

    throw lastError ?? new Error("Unknown error during torrent upload");
  }

  async removeTask(hash: string): Promise<boolean> {
    const sid = await this.ensureSid();
    const formData = new URLSearchParams();
    formData.append("sid", sid);
    formData.append("hash", hash);

    const response = await this.postForm(API_ENDPOINTS.TASK_REMOVE, formData, {
      label: "RemoveTask",
    });

    const payload = await this.parseJsonSafe(response);
    const errorCode = Number(payload?.error ?? -1);
    if (errorCode === 0) {
      return true;
    }

    throw new Error(`Remove task failed: error ${errorCode}`);
  }

  private async ensureSid(): Promise<string> {
    try {
      return await this.login();
    } catch (error) {
      this.sid = null;
      throw error;
    }
  }

  private async postForm(
    endpoint: string,
    formData: URLSearchParams | FormData,
    options: { label: string; signal?: AbortSignal }
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await this.fetchFn(url, {
      method: "POST",
      body: formData,
      signal: options.signal,
    });

    if (response.status === 403 || response.status === 401) {
      this.sid = null;
    }

    return response;
  }

  private async parseJsonSafe(response: Response): Promise<any> {
    try {
      return await response.clone().json();
    } catch {
      try {
        const text = await response.clone().text();
        return JSON.parse(text);
      } catch {
        return { error: -1 };
      }
    }
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}

export function createTorrentError(prefix: string, result: any): Error {
  const errorCode = Number(result?.error ?? -1);
  const reason = String(result?.reason ?? "").trim();
  const message = reason ? `${prefix} (${errorCode}): ${reason}` : `${prefix} (${errorCode})`;
  const error = new Error(message);
  (error as any).code = errorCode;
  (error as any).reason = reason;
  const reasonLower = reason.toLowerCase();
  if (reasonLower.includes("duplicate") || reasonLower.includes("exist")) {
    (error as any).duplicate = true;
  }
  if (errorCode === 2 || reasonLower.includes("no such api")) {
    (error as any).apiUnsupported = true;
  }
  return error;
}

function xmlToJSON(xml: string): Record<string, unknown> {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "application/xml");

    if (xmlDoc.documentElement.nodeName === "parsererror") {
      throw new Error("XML parse error");
    }

    return xmlNodeToJSON(xmlDoc.documentElement);
  } catch (error) {
    console.error("XML parse error", error);
    return {};
  }
}

function xmlNodeToJSON(node: Element): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (node.textContent && node.textContent.trim()) {
    result["#text"] = node.textContent.trim();
  }

  Array.from(node.children).forEach((child) => {
    const key = child.nodeName;
    const value = xmlNodeToJSON(child as Element);

    if (result[key]) {
      if (Array.isArray(result[key])) {
        (result[key] as Record<string, unknown>[]).push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  });

  return result;
}
