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
  server.resetHandlers();
  vi.restoreAllMocks();

  const apiModule = await import("@/popup/shared/api");
  apiModule.invalidateClientCache?.();
});

afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
});
