/**
 * Normalize a user-entered folder path to the relative form QNAP DS expects.
 *
 * Verified on a live NAS: DS paths are relative to the share root with NO leading
 * slash (`Download`, `Multimedia/Books`); an absolute `/share/Download` is rejected
 * with `error 4096`. So we strip leading/trailing slashes and an optional `share/`
 * prefix, mapping `/share/Download` → `Download`.
 *
 * This is the single source of truth for path normalization — both the folder
 * validation UI and the API client (`temp`/`move` on AddUrl/AddTorrent) run user
 * input through it so we never send an absolute path the NAS would reject.
 */
export function normalizeFolderPath(raw: string): string {
  let path = (raw ?? "").trim().replace(/\\/g, "/");
  path = path
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/{2,}/g, "/");
  if (/^share$/i.test(path)) return "";
  if (/^share\//i.test(path)) path = path.slice("share/".length);
  return path;
}
