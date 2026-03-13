import { resolve } from "node:path";
import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";
import manifest from "./manifest.json";

export default defineConfig({
  build: {
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
      "@ui": resolve(__dirname, "./src/ui"),
      "@types": resolve(__dirname, "./src/types"),
    },
  },
  plugins: [crx({ manifest })],
});
