/**
 * Utility functions for API data processing
 */

/**
 * Create a typed error from QNAP API response
 * Enriches error with code, reason, and flags for specific error types
 */
export function createApiError(prefix: string, result: any): Error {
  const errorCode = Number(result?.error ?? -1);
  const reason = String(result?.reason ?? "").trim();
  const message = reason ? `${prefix} (${errorCode}): ${reason}` : `${prefix} (${errorCode})`;
  
  const error = new Error(message) as Error & {
    code: number;
    reason: string;
    duplicate?: boolean;
    apiUnsupported?: boolean;
  };
  
  error.code = errorCode;
  error.reason = reason;
  
  // Flag duplicate errors
  const reasonLower = reason.toLowerCase();
  if (reasonLower.includes("duplicate") || reasonLower.includes("exist")) {
    error.duplicate = true;
  }
  
  // Flag unsupported API errors
  if (errorCode === 2 || reasonLower.includes("no such api")) {
    error.apiUnsupported = true;
  }
  
  return error;
}

/**
 * Simple promise-based delay utility
 */
export function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if API response indicates success
 */
export function isSuccessResponse(data: any): boolean {
  return data && Number(data.error ?? -1) === 0;
}

/**
 * Extract error message from API response
 */
export function getErrorMessage(data: any, defaultMessage = "Unknown error"): string {
  return data?.reason ?? data?.error ?? defaultMessage;
}
