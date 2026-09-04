import { defineConfig } from "vitest/config";

import { alias } from "./aliases.config";

export default defineConfig({
  resolve: { alias },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      reporter: ["text", "html"],
      include: ["src/api/**/*.ts", "src/popup/features/downloads/**/*.ts", "src/lib/settings.ts"],
      exclude: ["src/**/*.stories.ts", "src/**/index.ts", "src/env.d.ts"],
    },
  },
});
