import { getSnapshot } from "../downloads/downloadsState.js";

export function normalizeFileName(name: string): string {
  return name
    .replace(/\.torrent$/i, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function checkDuplicate(name: string): boolean {
  const snapshot = getSnapshot();
  if (snapshot.names.size === 0) return false;
  const normalized = normalizeFileName(name);
  return normalized ? snapshot.names.has(normalized) : false;
}
