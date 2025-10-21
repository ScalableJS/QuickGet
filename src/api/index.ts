import createClient, { type Middleware, type MiddlewareRequest } from "openapi-fetch";
import type { paths } from "./type.js";
import type { Settings } from "../lib/config.js";

export type ApiFetchClient = ReturnType<typeof createClient<paths>>;

export interface ClientSetupOptions {
  settings: Settings;
  fetchFn?: typeof fetch;
  logger?: { error: (msg: string, err?: any) => void; debug: (msg: string, data?: any) => void };
}

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

/**
 * Creates SID middleware for automatic SID injection and refresh
 * 
 * Implementation follows openapi-fetch middleware pattern:
 * - onRequest: Injects SID into every request (except login)
 * - onResponse: Clears SID on 401/403 to trigger re-authentication
 * - Handles both URLSearchParams and FormData body types
 * 
 * See: openapi-fetch-context.md for best practices
 */
export function createSidMiddleware(options: {
  settings: Settings;
  logger?: { error: (msg: string, err?: any) => void; debug: (msg: string, data?: any) => void };
}): Middleware {
  let sid: string | null = null;
  const { settings, logger } = options;
  const UNPROTECTED_ROUTES = ["/downloadstation/V4/Misc/Login"];

  return {
    async onRequest(request: MiddlewareRequest) {
      // Skip login endpoint itself
      if (UNPROTECTED_ROUTES.some((route) => request.schemaPath.startsWith(route))) {
        return request;
      }

      // Ensure SID exists
      if (!sid) {
        try {
          const loginResult = await performLogin(settings);
          sid = loginResult.sid;
          logger?.debug("SID obtained", { sid, user: loginResult.user });
        } catch (error) {
          logger?.error("Failed to obtain SID", error);
          throw error;
        }
      }

      // Add SID to form data
      const contentType = request.headers.get("content-type") || "";
      
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const body = await request.clone().text();
        const form = new URLSearchParams(body);
        form.append("sid", sid);
        return new Request(request, { body: form.toString() });
      }

      // For multipart/form-data
      if (contentType.includes("multipart/form-data") || request.schemaPath.includes("/Task/Add")) {
        // Если body это FormData - используем как есть
        try {
          const originalForm = await request.clone().formData();
          const newFormData = new FormData();
          for (const [key, value] of originalForm) {
            newFormData.append(key, value);
          }
          newFormData.append("sid", sid);
          return new Request(request, { body: newFormData });
        } catch (e) {
          // Если не FormData, возможно это объект - нужно преобразовать
          // Но это сложно, так как мы не знаем тип body
          logger?.debug("Failed to parse as FormData, trying as JSON object");
        }
      }

      return request;
    },

    async onResponse(response: Response, _options, request: MiddlewareRequest) {
      // Handle 403/401 - invalid SID
      if ((response.status === 403 || response.status === 401) && !UNPROTECTED_ROUTES.some((route) => request.schemaPath.startsWith(route))) {
        sid = null; // Clear SID to force re-login next time
        logger?.debug("SID invalidated, will refresh on next request");
      }

      return response;
    },
  };
}

/**
 * Performs login and returns SID
 */
export interface LoginResult {
  sid: string;
  user: string;
}

export async function performLogin(settings: Settings): Promise<LoginResult> {
  const baseUrl = buildNASBaseUrl(settings);
  const formData = new URLSearchParams();
  formData.append("user", settings.NASlogin);
  formData.append("pass", btoa(settings.NASpassword));

  const response = await fetch(`${baseUrl}/downloadstation/V4/Misc/Login`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`NAS login failed: ${response.statusText}`);
  }

  // QNAP V4 API returns JSON
  let data: any;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("NAS login failed: invalid JSON response");
  }

  if (!data?.sid) {
    throw new Error("NAS login failed: no SID in response");
  }

  return {
    sid: String(data.sid),
    user: String(data.user ?? settings.NASlogin),
  };
}

/**
 * Creates openapi-fetch client with SID middleware
 */
export function createOpenApiFetchClient(options: ClientSetupOptions): ApiFetchClient {
  const fetchImpl = options.fetchFn ?? fetch;
  const fetchFn = ((input, init) => fetchImpl(input, init)) as typeof fetch;
  const baseUrl = buildNASBaseUrl(options.settings);

  const client = createClient<paths>({
    baseUrl,
    fetch: fetchFn,
  });

  const sidMiddleware = createSidMiddleware({
    settings: options.settings,
    logger: options.logger,
  });

  client.use(sidMiddleware);

  return client;
}
