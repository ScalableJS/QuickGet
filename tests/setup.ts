import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";

import { installChromeMock, resetChromeMockState } from "./mocks/chrome";
import { server } from "./msw/server";

installChromeMock();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
  resetChromeMockState();
});

afterEach(async () => {
  // Mock restoration is handled by `restoreMocks` in vitest.config.ts.
  server.resetHandlers();

  const apiModule = await import("@/popup/shared/api");
  apiModule.invalidateClientCache?.();
});

afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
});
