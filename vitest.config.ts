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
      include: [
        "src/api/**/*.ts",
        "src/background/**/*.ts",
        "src/content/**/*.ts",
        "src/lib/**/*.ts",
        "src/popup/components/**/*.ts",
        "src/popup/features/**/*.ts",
        "src/popup/shared/**/*.ts",
      ],
      exclude: ["src/**/*.stories.ts", "src/**/*.test.ts", "src/**/index.ts", "src/env.d.ts", "src/**/*.d.ts"],
    },
  },
});
