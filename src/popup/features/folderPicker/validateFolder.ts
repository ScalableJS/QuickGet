import type { DirEntry } from "@api/client.js";
import { getErrorMessage } from "@lib/errors.js";
import { normalizeFolderPath } from "@lib/folderPath.js";

export { normalizeFolderPath };

/**
 * Result of validating a NAS folder path.
 *
 * - `valid`   — the folder exists on the NAS and is writable.
 * - `invalid` — definitively wrong (missing, read-only). Surface a red ring.
 * - `error`   — could not be checked (NAS unreachable / login / unexpected error).
 *               NOT a red ring — we don't punish offline users for an unverifiable path.
 */
export type FolderValidationStatus = "valid" | "invalid" | "error";

/** UI field status: the validation verdict plus the two pre-verdict states. */
export type FolderFieldStatus = "idle" | "validating" | FolderValidationStatus;

export type FolderValidation = {
  status: FolderValidationStatus;
  reason?: string;
};

/** Lists a NAS directory's children (typically `ApiClient.listDir`). */
export type FolderLister = (path: string) => Promise<DirEntry[]>;

/**
 * Validate that `raw` is an existing, writable folder on the NAS.
 *
 * Strategy: list the **parent** directory and look for the target among its
 * children — the parent listing is the only place the target's own `writtable`
 * flag appears. A missing parent surfaces as the `4096` code (definitively
 * invalid); anything else thrown is treated as unverifiable (`error`).
 */
export async function validateFolder(raw: string, listDir: FolderLister): Promise<FolderValidation> {
  const path = normalizeFolderPath(raw);
  if (path === "") {
    // Empty / share-root — nothing to verify, treat as valid (callers gate "required" separately).
    return { status: "valid" };
  }

  const slash = path.lastIndexOf("/");
  const parent = slash === -1 ? "" : path.slice(0, slash);
  const name = slash === -1 ? path : path.slice(slash + 1);

  try {
    const entries = await listDir(parent);
    const match = entries.find((entry) => entry.path === path || entry.dir === name);
    if (!match) {
      return { status: "invalid", reason: "Folder not found on NAS" };
    }
    if (!match.writtable) {
      return { status: "invalid", reason: "Folder is read-only" };
    }
    return { status: "valid" };
  } catch (error) {
    if ((error as { code?: number })?.code === PATH_NOT_FOUND_CODE) {
      return { status: "invalid", reason: "Folder not found on NAS" };
    }
    return { status: "error", reason: getErrorMessage(error) };
  }
}

// QNAP DS `Misc/Dir` returns {error:4096, reason:"path"} for a path that does not
// exist (or an absolute "/share/..." path). Verified on a live NAS (2026-06-20).
const PATH_NOT_FOUND_CODE = 4096;
