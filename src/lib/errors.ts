/**
 * Normalize an unknown thrown value to a human-readable message.
 * Error instances yield their `.message`; anything else is stringified.
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
