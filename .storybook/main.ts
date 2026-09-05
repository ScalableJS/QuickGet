import type { StorybookConfig } from "@storybook/svelte-vite";
import UnoCSS from "unocss/vite";
import Icons from "unplugin-icons/vite";
import { mergeConfig, type UserConfig } from "vite";

import { alias } from "../aliases.config.js";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|ts|svelte)"],
  // a11y runs axe over every story; the settings form is the reason it is here.
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],

  framework: {
    name: "@storybook/svelte-vite",
    options: {},
  },

  async viteFinal(baseConfig) {
    const overrides: UserConfig = {
      resolve: { alias },
      plugins: [UnoCSS(), Icons({ compiler: "svelte" })],
    };

    return mergeConfig(baseConfig, overrides);
  },
};

export default config;
