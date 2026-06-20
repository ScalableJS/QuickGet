import createClient, { type Middleware } from "openapi-fetch";

import type { Settings } from "@lib/config.js";

import type { paths } from "./type.js";

export type ApiFetchClient = ReturnType<typeof createClient<paths>>;

export type ClientSetupOptions = {
  settings: Settings;
  fetchFn?: typeof fetch;
  logger?: LoggerAdapter;
};

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
 * QNAP DS body-level error codes that mean "the session is no longer valid".
 * Verified on a live NAS: `{"error":5,"reason":"session error"}` is returned
 * with HTTP 200 when the SID has expired — so it cannot be detected by status
 * code alone.
 */
const SESSION_ERROR_CODES = new Set([5]);

/**
 * Creates SID middleware for automatic SID injection and transparent re-login.
 *
 * Implementation follows openapi-fetch middleware pattern:
 * - onRequest: injects SID into every request (except login)
 * - onResponse: detects an expired session (HTTP 401/403 OR body `error:5`),
 *   re-logs in once and transparently replays the original request with the
 *   fresh SID. The replay goes straight through `fetchFn` (bypassing this
 *   middleware) so it can never loop more than once.
 * - Handles both URLSearchParams and FormData body types.
 *
 * `fetchFn` must be the same fetch implementation the client uses, so the
 * replay is intercepted by MSW in tests and behaves identically in production.
 */
function createSidMiddleware(options: {
  settings: Settings;
  logger?: LoggerAdapter;
  fetchFn?: typeof fetch;
}): Middleware {
  let sid: string | null = null;
  let loginInFlight: Promise<string> | null = null;
  const { settings, logger } = options;
  const fetchFn = options.fetchFn ?? fetch;
  const UNPROTECTED_ROUTES = ["/downloadstation/V4/Misc/Login"];
  const isUnprotected = (schemaPath: string) => UNPROTECTED_ROUTES.some((route) => schemaPath.startsWith(route));

  // Remembers the urlencoded body we sent for each request so it can be replayed
  // after a re-login. openapi-fetch consumes the request body before onResponse,
  // so we cannot clone it there — we rebuild from this stored text instead.
  const sentUrlencodedBodies = new WeakMap<Request, string>();

  /** Returns a valid SID, logging in if needed. Concurrent callers share one login. */
  async function ensureSid(): Promise<string> {
    if (sid) {
      return sid;
    }
    if (!loginInFlight) {
      loginInFlight = performLogin(settings)
        .then((result) => {
          sid = result.sid;
          logger?.debug("SID obtained", { user: result.user });
          return result.sid;
        })
        .finally(() => {
          loginInFlight = null;
        });
    }
    return loginInFlight;
  }

  /** Returns a copy of `request` with `sid` set (replacing any existing value). */
  async function injectSid(request: Request, sidValue: string): Promise<Request> {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = new URLSearchParams(await request.clone().text());
      form.set("sid", sidValue);
      const text = form.toString();
      const injected = new Request(request, { body: text });
      sentUrlencodedBodies.set(injected, text);
      return injected;
    }

    if (contentType.includes("multipart/form-data") || request.url.includes("/Task/Add")) {
      try {
        const originalForm = await request.clone().formData();
        const newFormData = new FormData();
        for (const [key, value] of originalForm) {
          if (key !== "sid") {
            newFormData.append(key, value);
          }
        }
        newFormData.append("sid", sidValue);
        return new Request(request, { body: newFormData });
      } catch {
        logger?.debug("Failed to parse body as FormData, sending request unchanged");
      }
    }

    return request;
  }

  /** True if the response signals an expired/invalid session. */
  async function isSessionExpired(response: Response): Promise<boolean> {
    if (response.status === 401 || response.status === 403) {
      return true;
    }
    try {
      const payload = (await response.clone().json()) as { error?: unknown };
      return typeof payload.error === "number" && SESSION_ERROR_CODES.has(payload.error);
    } catch {
      return false;
    }
  }

  return {
    async onRequest({ request, schemaPath }) {
      if (isUnprotected(schemaPath)) {
        return request;
      }
      try {
        const current = await ensureSid();
        return injectSid(request, current);
      } catch (error) {
        logger?.error("Failed to obtain SID", error);
        throw error;
      }
    },

    async onResponse({ request, response, schemaPath }) {
      if (isUnprotected(schemaPath) || !(await isSessionExpired(response))) {
        return response;
      }

      // We can only safely replay requests whose body we captured (urlencoded).
      // Non-replayable requests just surface the original error after clearing
      // the SID, so the next call re-authenticates.
      const previousBody = sentUrlencodedBodies.get(request);
      if (previousBody === undefined) {
        sid = null;
        logger?.debug("Session expired on a non-replayable request; SID cleared for next call");
        return response;
      }

      logger?.debug("Session expired, re-logging in and retrying request once");
      sid = null; // force a fresh login

      let freshSid: string;
      try {
        freshSid = await ensureSid();
      } catch (error) {
        logger?.error("Re-login after session expiry failed", error);
        return response; // surface the original error
      }

      // Rebuild the request from the captured body with the fresh SID and replay
      // it straight through fetchFn, bypassing this middleware so it never recurses.
      const form = new URLSearchParams(previousBody);
      form.set("sid", freshSid);
      const retried = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: form.toString(),
      });
      return fetchFn(retried);
    },
  };
}

/**
 * Performs login and returns SID
 */
export type LoginResult = {
  sid: string;
  user: string;
};

export type LoggerAdapter = {
  error: (msg: string, err?: unknown) => void;
  debug: (msg: string, data?: unknown) => void;
};

export async function performLogin(settings: Settings): Promise<LoginResult> {
  const baseUrl = buildNASBaseUrl(settings);
  const encodedAttempt = await requestLogin(baseUrl, settings.NASlogin, encodeQnapPassword(settings.NASpassword));
  if (encodedAttempt.sid) {
    return { sid: encodedAttempt.sid, user: encodedAttempt.user };
  }

  const shouldRetryWithRawPassword = encodedAttempt.payload.error === 4 && settings.NASpassword.length > 0;
  if (shouldRetryWithRawPassword) {
    const rawAttempt = await requestLogin(baseUrl, settings.NASlogin, settings.NASpassword);
    if (rawAttempt.sid) {
      return { sid: rawAttempt.sid, user: rawAttempt.user };
    }
  }

  throw buildLoginError(encodedAttempt.payload);
}

type LoginAttemptResult = {
  sid: string | null;
  user: string;
  payload: Record<string, unknown>;
};

async function requestLogin(baseUrl: string, username: string, passwordValue: string): Promise<LoginAttemptResult> {
  const formData = new URLSearchParams();
  formData.append("user", username);
  formData.append("pass", passwordValue);

  const response = await fetch(`${baseUrl}/downloadstation/V4/Misc/Login`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`NAS login failed: ${response.statusText}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("NAS login failed: invalid JSON response");
  }

  if (typeof data !== "object" || data === null) {
    throw new Error("NAS login failed: malformed response");
  }

  const payload = data as Record<string, unknown>;
  const sidValue = payload.sid;
  const sid = typeof sidValue === "string" ? sidValue : sidValue != null ? String(sidValue) : null;

  return {
    sid,
    user: typeof payload.user === "string" ? payload.user : payload.user != null ? String(payload.user) : username,
    payload,
  };
}

function buildLoginError(payload: Record<string, unknown>): Error {
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  const errorCode = typeof payload.error === "number" ? payload.error : Number(payload.error ?? -1);
  if (!Number.isNaN(errorCode) && errorCode >= 0) {
    return new Error(reason ? `NAS login failed (${errorCode}): ${reason}` : `NAS login failed (${errorCode})`);
  }
  return new Error("NAS login failed: no SID in response");
}

function encodeQnapPassword(password: string): string {
  const bytes = new TextEncoder().encode(password);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
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
    fetchFn,
  });

  client.use(sidMiddleware);

  return client;
}
