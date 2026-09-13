import { defineConfig } from "vitest/config";

import { alias } from "./aliases.config";

/**
 * Two projects, because they need opposite environments.
 *
 * **unit** is the extension's own code: jsdom, a mocked `chrome.*`, and MSW intercepting every
 * request with `onUnhandledRequest: "error"` — nothing may reach the network by accident.
 *
 * **fixtures** is the test infrastructure itself — the stand and the mock NAS. Those *are* HTTP
 * servers, so they run under Node with real sockets and no MSW. They earn tests of their own for
 * the same reason any fixture does: one that lies produces green suites about behaviour that does
 * not exist.
 */
export default defineConfig({
  resolve: { alias },
  test: {
    clearMocks: true,
    restoreMocks: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
          include: ["src/**/*.test.ts"],
          clearMocks: true,
          restoreMocks: true,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "fixtures",
          environment: "node",
          // Real sockets, and some cases deliberately stall; the 5 s default is too tight.
          testTimeout: 20_000,
          include: ["tests/e2e/support/**/*.test.ts"],
        },
      },
    ],
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
