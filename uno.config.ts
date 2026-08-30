import extractorSvelte from "@unocss/extractor-svelte";
import { defineConfig, presetWind4 } from "unocss";
export default defineConfig({
  extractors: [extractorSvelte()],
  presets: [
    presetWind4({
      preflights: {
        reset: false,
      },
    }),
  ],
});
