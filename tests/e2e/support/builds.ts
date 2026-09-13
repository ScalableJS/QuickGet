import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Which build a spec loads is a deliberate split, not an accident of copy-paste.
 *
 * **Mock suite → the dev build.** It is the artifact developers actually run unpacked beside the
 * installed release, and it is checked against `mockNas.ts`, a server written to answer the
 * questions the suite asks. Fast, hermetic, safe to run on every commit.
 *
 * **Real NAS and anything that ships → the production build.** The point is that the bytes
 * validated against a live Download Station are the same bytes uploaded to the Web Store. A green
 * real-NAS run on `dist-dev` would prove something about an artifact nobody installs: the dev
 * manifest drops the `key` and renames the extension, so it is not the release.
 *
 * The two differ only in the manifest today. That is not a reason to collapse them — it is a
 * reason the split is cheap, and the invariant it protects ("we tested what we shipped") is the
 * kind that stops being true quietly.
 */
export const devBuildPath = path.join(rootDir, "dist-dev");

/** The production bundle — what `npm run build` emits and what the Web Store receives. */
export const prodBuildPath = path.join(rootDir, "dist");
