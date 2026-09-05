import { fileURLToPath } from "node:url";

/**
 * The single source of truth for path aliases.
 *
 * Vite, Vitest and Storybook each need the same map, and keeping three hand-written copies is
 * what let `@ui` drift to a directory that does not exist. `tsconfig.json` still declares its own
 * `paths` because TypeScript cannot read this file, so that copy is the one to keep in sync.
 */
export const alias = {
  "@": resolveFromRoot("src"),
  "@api": resolveFromRoot("src/api"),
  "@lib": resolveFromRoot("src/lib"),
  "@ui": resolveFromRoot("src/popup/ui"),
} as const;

function resolveFromRoot(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}
