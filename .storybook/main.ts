import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/html-vite";
import { mergeConfig, type UserConfig } from "vite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|ts)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-interactions"],
  framework: {
    name: "@storybook/html-vite",
    options: {},
  },
  async viteFinal(baseConfig) {
    const aliasConfig: UserConfig = {
      resolve: {
        alias: {
          "@": resolve(projectRoot, "src"),
          "@lib": resolve(projectRoot, "src/lib"),
          "@ui": resolve(projectRoot, "src/ui"),
          "@types": resolve(projectRoot, "src/types"),
        },
      },
      plugins: [],
    };

    return mergeConfig(baseConfig, aliasConfig);
  },
  docs: {
    autodocs: false,
  },
};

export default config;
