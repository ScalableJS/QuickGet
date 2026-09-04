import { resolve } from "node:path";
import { crx, type ManifestV3Export } from "@crxjs/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import UnoCSS from "unocss/vite";
import Icons from "unplugin-icons/vite";
import { defineConfig, type PluginOption } from "vite";

import { alias } from "./aliases.config";
import chromeManifestJson from "./manifest.json";
import firefoxManifestJson from "./manifest.firefox.json";

/** The plain-object arm of `ManifestV3Export`; the plugin also accepts a promise or a function. */
type Manifest = Extract<ManifestV3Export, { manifest_version: number }>;

/**
 * Importing a manifest from JSON widens every string literal to `string`, which stops matching the
 * literal unions crxjs uses — the Gecko data-collection permissions above all. Narrowing here is
 * what keeps both manifests checked against the plugin's own shape.
 */
const chromeManifest = chromeManifestJson as Manifest;
const firefoxManifest = firefoxManifestJson as Manifest;

const isStorybook = process.argv.some((arg) => arg.includes("storybook") || arg.includes("build-storybook"));
const isFirefox = process.env.BROWSER_TARGET === "firefox";

/**
 * An unpacked dev build meant to run *alongside* the published extension.
 *
 * `key` in the manifest pins the extension ID to the one the Web Store issued, so an unpacked
 * copy carrying it collides with the installed release and Chrome refuses to load it. Dropping
 * the key lets Chrome derive an ID from the directory instead, and the renamed title keeps the
 * two apart in the extensions list and the context menu.
 */
const isDevBuild = process.env.DEV_UNPACKED === "1";

const manifest: Manifest = isFirefox
  ? firefoxManifest
  : isDevBuild
    ? devManifest(chromeManifest)
    : chromeManifest;

function devManifest(base: Manifest): Manifest {
  const { key: _key, ...rest } = base;
  return { ...rest, name: `${base.name} (dev)` };
}
const plugins: PluginOption[] = [UnoCSS(), svelte(), Icons({ compiler: "svelte" })];
if (!isStorybook) {
  plugins.push(crx({ manifest }));
}

export default defineConfig({
  build: {
    outDir: isFirefox ? "dist-firefox" : isDevBuild ? "dist-dev" : "dist",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.html"),
      },
    },
  },
  resolve: { alias },
  plugins,
});
