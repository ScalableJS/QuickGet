import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Worker } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startFixtureHost } from "./support/fixtureHost.js";
import { startMockNas } from "./support/mockNas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");
const fixturePath = path.resolve(__dirname, "fixtures/magnet-fixture.html");

type Settings = Record<string, unknown>;

function seedSettings(worker: Worker, settings: Settings): Promise<unknown> {
  return worker.evaluate((values) => chrome.storage.local.set(values as Settings), settings);
}

function nasSettings(port: number, overrides: Settings = {}): Settings {
  return {
    NASaddress: "127.0.0.1",
    NASport: String(port),
    NASsecure: false,
    NASlogin: "admin",
    NASpassword: "demo-password",
    NAStempdir: "Download",
    NASdir: "Multimedia/Movies",
    autoCaptureMagnets: true,
    torrentInterceptMode: "always",
    suppressLocalTorrentFile: false,
    routingRules: [],
    theme: "auto",
    ...overrides,
  };
}

test.describe("magnet link interception (GAP-1)", () => {
  test("intercepts direct magnet link click when autoCaptureMagnets is on", async () => {
    const mockNas = await startMockNas();
    const fixtureHost = await startFixtureHost(fixturePath);
    const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-e2e-magnet-"));
    const session = await launchExtensionPopup(extensionDistPath, { downloadsPath });

    try {
      await seedSettings(session.worker, nasSettings(mockNas.port, { autoCaptureMagnets: true }));
      const page = await session.context.newPage();
      await page.goto(fixtureHost.url);

      await page.click("#magnet-simple");

      await expect
        .poll(() => mockNas.requestLog.includesPath("/downloadstation/V4/Task/AddUrl"), {
          timeout: 10_000,
        })
        .toBe(true);

      const addUrlRequests = mockNas.requestLog
        .toJSON()
        .filter((req) => req.path === "/downloadstation/V4/Task/AddUrl");
      expect(addUrlRequests.length).toBe(1);
      expect(decodeURIComponent(addUrlRequests[0].requestBody ?? "")).toContain("Ubuntu+ISO");

      // Verify page was prevented from default action
      const lastClick = await page.evaluate(() => (window as unknown as { lastClick: { defaultPrevented: boolean } }).lastClick);
      expect(lastClick?.defaultPrevented).toBe(true);
    } finally {
      await session.close();
      await fixtureHost.close();
      await mockNas.close();
    }
  });

  test("intercepts clicks on nested elements inside an anchor", async () => {
    const mockNas = await startMockNas();
    const fixtureHost = await startFixtureHost(fixturePath);
    const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-e2e-magnet-"));
    const session = await launchExtensionPopup(extensionDistPath, { downloadsPath });

    try {
      await seedSettings(session.worker, nasSettings(mockNas.port, { autoCaptureMagnets: true }));
      const page = await session.context.newPage();
      await page.goto(fixtureHost.url);

      // Click the SVG/span inside the anchor
      await page.click("#magnet-nested span");

      await expect
        .poll(() => mockNas.requestLog.includesPath("/downloadstation/V4/Task/AddUrl"), {
          timeout: 10_000,
        })
        .toBe(true);

      const addUrlRequests = mockNas.requestLog
        .toJSON()
        .filter((req) => req.path === "/downloadstation/V4/Task/AddUrl");
      expect(decodeURIComponent(addUrlRequests[0].requestBody ?? "")).toContain("Nested+Arch");
    } finally {
      await session.close();
      await fixtureHost.close();
      await mockNas.close();
    }
  });

  test("does not intercept clicks when autoCaptureMagnets is off", async () => {
    const mockNas = await startMockNas();
    const fixtureHost = await startFixtureHost(fixturePath);
    const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-e2e-magnet-"));
    const session = await launchExtensionPopup(extensionDistPath, { downloadsPath });

    try {
      await seedSettings(session.worker, nasSettings(mockNas.port, { autoCaptureMagnets: false }));
      const page = await session.context.newPage();
      await page.goto(fixtureHost.url);

      await page.click("#magnet-simple");

      // Give event loop time to dispatch
      await page.waitForTimeout(500);

      const addUrlRequests = mockNas.requestLog
        .toJSON()
        .filter((req) => req.path === "/downloadstation/V4/Task/AddUrl");
      expect(addUrlRequests.length).toBe(0);

      const lastClick = await page.evaluate(() => (window as unknown as { lastClick: { defaultPrevented: boolean } }).lastClick);
      expect(lastClick?.defaultPrevented).toBe(false);
    } finally {
      await session.close();
      await fixtureHost.close();
      await mockNas.close();
    }
  });

  test("reacts live to toggling autoCaptureMagnets without page reload", async () => {
    const mockNas = await startMockNas();
    const fixtureHost = await startFixtureHost(fixturePath);
    const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-e2e-magnet-"));
    const session = await launchExtensionPopup(extensionDistPath, { downloadsPath });

    try {
      // Start disabled
      await seedSettings(session.worker, nasSettings(mockNas.port, { autoCaptureMagnets: false }));
      const page = await session.context.newPage();
      await page.goto(fixtureHost.url);

      // Prevent external protocol dialog from locking the Chromium window on unintercepted click
      await page.evaluate(() => {
        window.addEventListener("click", (e) => e.preventDefault(), false);
      });

      // First click: disabled -> not intercepted by extension
      await page.click("#magnet-simple");
      await page.waitForTimeout(300);
      expect(
        mockNas.requestLog.toJSON().filter((req) => req.path === "/downloadstation/V4/Task/AddUrl").length,
      ).toBe(0);

      // Toggle setting to true live via storage
      await seedSettings(session.worker, { autoCaptureMagnets: true });
      await page.waitForTimeout(300);

      // Second click in the same tab: now intercepted
      await page.click("#magnet-simple");
      await expect
        .poll(
          () =>
            mockNas.requestLog
              .toJSON()
              .filter((req) => req.path === "/downloadstation/V4/Task/AddUrl").length,
          { timeout: 10_000 },
        )
        .toBe(1);
    } finally {
      await session.close();
      await fixtureHost.close();
      await mockNas.close();
    }
  });

  test("ignores untrusted (synthetic) script clicks for security", async () => {
    const mockNas = await startMockNas();
    const fixtureHost = await startFixtureHost(fixturePath);
    const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-e2e-magnet-"));
    const session = await launchExtensionPopup(extensionDistPath, { downloadsPath });

    try {
      await seedSettings(session.worker, nasSettings(mockNas.port, { autoCaptureMagnets: true }));
      const page = await session.context.newPage();
      await page.goto(fixtureHost.url);

      // Programmatic synthetic click from the webpage
      await page.evaluate(() => {
        document.getElementById("magnet-simple")?.click();
      });

      await page.waitForTimeout(500);

      const addUrlRequests = mockNas.requestLog
        .toJSON()
        .filter((req) => req.path === "/downloadstation/V4/Task/AddUrl");
      expect(addUrlRequests.length).toBe(0);
    } finally {
      await session.close();
      await fixtureHost.close();
      await mockNas.close();
    }
  });

  test("leaves normal HTTP links untouched", async () => {
    const mockNas = await startMockNas();
    const fixtureHost = await startFixtureHost(fixturePath);
    const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-e2e-magnet-"));
    const session = await launchExtensionPopup(extensionDistPath, { downloadsPath });

    try {
      await seedSettings(session.worker, nasSettings(mockNas.port, { autoCaptureMagnets: true }));
      const page = await session.context.newPage();
      await page.goto(fixtureHost.url);

      await page.click("#normal-link");
      await page.waitForTimeout(300);

      const addUrlRequests = mockNas.requestLog
        .toJSON()
        .filter((req) => req.path === "/downloadstation/V4/Task/AddUrl");
      expect(addUrlRequests.length).toBe(0);
    } finally {
      await session.close();
      await fixtureHost.close();
      await mockNas.close();
    }
  });
});
