import { resolve } from "node:path";
import { crx } from "@crxjs/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";
import chromeManifest from "./manifest.json";
import firefoxManifest from "./manifest.firefox.json";

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

const manifest = isFirefox
  ? firefoxManifest
  : isDevBuild
    ? devManifest(chromeManifest)
    : chromeManifest;

function devManifest(base: typeof chromeManifest): typeof chromeManifest {
  const { key: _key, ...rest } = base;
  return { ...rest, name: `${base.name} (dev)` } as typeof chromeManifest;
}
const plugins = [svelte(), Icons({ compiler: "svelte" })];
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
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@api": resolve(__dirname, "./src/api"),
      "@lib": resolve(__dirname, "./src/lib"),
      "@ui": resolve(__dirname, "./src/popup/ui"),
    },
  },
  plugins,
});
