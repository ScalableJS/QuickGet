import type { BaseResponse } from "./type.js";

type ApiResult = Partial<BaseResponse> & Record<string, unknown>;

function toApiResult(value: unknown): ApiResult {
  if (typeof value === "object" && value !== null) {
    return value as ApiResult;
  }
  return { error: -1 };
}

const hasFalsyString = (value: unknown): boolean => typeof value === "string" && value.trim().length === 0;

const coerceNumber = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
};

const coerceString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

/**
 * Create a typed error from QNAP API response
 * Enriches error with code, reason, and flags for specific error types
 */
/**
 * Download Station's own error codes, with its own wording.
 *
 * Not guessed and not translated from a third-party client: read out of the NAS's own web app,
 * where `libs/ds-all.js` maps each code to a `LANG.ERR_*` key and `lang/ENG.js` gives that key
 * its English sentence. Both files are served without credentials, so this can be re-derived on
 * any QTS box:
 *
 *   curl -s http://<nas>:8080/downloadstation/libs/ds-all.js | grep -oE '[0-9]+:LANG\.ERR_[A-Z_0-9]+'
 *   curl -s http://<nas>:8080/downloadstation/lang/ENG.js
 *
 * Why this table earns its place: `reason` is not an explanation. For 12288 the NAS echoes the
 * URL back, so a message built from `reason` alone read "Add URL failed:
 * http://…/linux-minimal.iso" — it repeated what the user had just clicked and said nothing about
 * why. The code is the part that carries meaning.
 */
const DS_ERROR_MESSAGES: Record<number, string> = {
  1: "Incorrect parameters for the API.",
  2: "This API does not exist.",
  3: "Incorrect parameters for the API.",
  4: "Failed to log in.",
  5: "Your connection has expired. Please log in again.",
  6: "Access is denied.",
  7: "Access is denied.",
  8: "An exception occurred in a background process.",
  4096: "This directory does not exist.",
  4097: "You cannot access this directory.",
  4098: "A background process failed to execute.",
  8192: "No tasks are available.",
  8193: "The task was not found.",
  8194: "You are not the task owner.",
  8195: "Download Station has reached its maximum of 30 tasks.",
  8196: "This task already exists.",
  8197: "Files are being moved, please try again later.",
  8198: "The task is already running.",
  8199: "The task is not running.",
  12288: "Download Station does not support this URL.",
  12289: "Download Station could not download from this URL.",
  12290: "Download Station could not resolve that host.",
  12291: "A directory already exists where the temporary file should go.",
  12292: "Download Station could not create its temporary file.",
  16384: "Incorrect magnet format.",
  16385: "The torrent file was not found.",
  16386: "Incorrect torrent file format.",
  16387: "Download Station rejected the torrent configuration.",
};

/**
 * Turn the API's field-name reasons into something the user can act on. Download Station
 * answers `{error: 1, reason: "temp"}` when a required folder is empty or unusable — a message
 * naming the setting is the difference between a fixable problem and an opaque code.
 */
function explainReason(errorCode: number, reason: string): string | undefined {
  if (errorCode !== 1) return undefined;

  if (reason === "temp") {
    return "Download Station rejected the temporary folder. Set a valid Temp Folder in Settings (e.g. Download).";
  }
  if (reason === "move" || reason === "dest_path") {
    return "Download Station rejected the destination folder. Check the Target Folder in Settings.";
  }
  return undefined;
}

export function createApiError(prefix: string, result: unknown): Error {
  const payload = toApiResult(result);
  const errorCode = coerceNumber(payload.error, -1);
  const reason = coerceString(payload.reason).trim();
  const known = DS_ERROR_MESSAGES[errorCode];
  // The reason is kept whenever it carries something the sentence does not — `{error: 1,
  // reason: "rejected"}` is all the NAS will say about that failure. It is dropped only when it
  // is the URL we just sent back at us, which is what made 12288 unreadable.
  const detail = reason && !/^[a-z][a-z0-9+.-]*:\/\//i.test(reason) ? reason : "";
  const message =
    explainReason(errorCode, reason) ??
    (known
      ? detail
        ? `${prefix}: ${known} (${detail})`
        : `${prefix}: ${known}`
      : detail
        ? `${prefix} (${errorCode}): ${detail}`
        : `${prefix} (${errorCode})`);

  const error = new Error(message) as Error & {
    code: number;
    reason: string;
    duplicate?: boolean;
    apiUnsupported?: boolean;
  };

  error.code = errorCode;
  error.reason = reason;

  // Flag duplicate errors. QNAP DS V4 reports an already-existing task via
  // AddTorrent as error code 8196 with reason set to the torrent name (no
  // "duplicate"/"exist" keyword) — verified on a live NAS — so match the code
  // as well as the textual reason.
  const reasonLower = reason.toLowerCase();
  if (errorCode === 8196 || reasonLower.includes("duplicate") || reasonLower.includes("exist")) {
    error.duplicate = true;
  }

  // Flag unsupported API errors
  if (errorCode === 2 || reasonLower.includes("no such api")) {
    error.apiUnsupported = true;
  }

  return error;
}

/**
 * Check if API response indicates success
 */
export function isSuccessResponse(data: unknown): data is BaseResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const payload = data as Record<string, unknown>;
  const errorCode = coerceNumber(payload.error, -1);
  return errorCode === 0 && !hasFalsyString(payload.error);
}

/**
 * Extract error message from API response
 */
export function getErrorMessage(data: unknown, defaultMessage = "Unknown error"): string {
  if (typeof data !== "object" || data === null) {
    return defaultMessage;
  }
  const payload = data as Record<string, unknown>;
  const reason = coerceString(payload.reason);
  if (reason) {
    return reason;
  }
  const error = coerceString(payload.error);
  return error || defaultMessage;
}
