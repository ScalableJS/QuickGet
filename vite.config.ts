import { resolve } from "node:path";
import { crx } from "@crxjs/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";
import manifest from "./manifest.json";

const isStorybook = process.argv.some((arg) => arg.includes("storybook") || arg.includes("build-storybook"));
const plugins = [svelte(), Icons({ compiler: "svelte" })];
if (!isStorybook) {
  plugins.push(crx({ manifest }));
}

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.html"),
        chooser: resolve(__dirname, "src/chooser/index.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@api": resolve(__dirname, "./src/api"),
      "@lib": resolve(__dirname, "./src/lib"),
    },
  },
  plugins,
});
