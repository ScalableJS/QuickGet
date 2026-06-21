import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/svelte-vite";
import Icons from "unplugin-icons/vite";
import { mergeConfig, type UserConfig } from "vite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|ts|svelte)"],
  addons: ["@storybook/addon-docs"],

  framework: {
    name: "@storybook/svelte-vite",
    options: {},
  },

  async viteFinal(baseConfig) {
    const overrides: UserConfig = {
      resolve: {
        alias: {
          "@": resolve(projectRoot, "src"),
          "@api": resolve(projectRoot, "src/api"),
          "@lib": resolve(projectRoot, "src/lib"),
          "@ui": resolve(projectRoot, "src/popup/ui"),
          "@types": resolve(projectRoot, "src/types"),
        },
      },
      plugins: [Icons({ compiler: "svelte" })],
    };

    return mergeConfig(baseConfig, overrides);
  },
};

export default config;
