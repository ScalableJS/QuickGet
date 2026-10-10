import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Worker } from "@playwright/test";

import { devBuildPath } from "./support/builds.js";
import { launchExtensionPopup } from "./support/extension.js";
import { startFixtureHost } from "./support/fixtureHost.js";
import { startMockNas } from "./support/mockNas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
    interceptFileLinks: false,
    routingRules: [],
    theme: "auto",
    ...overrides,
  };
}

test.describe("magnet link interception (GAP-1)", () => {
  test("always sends a direct magnet click and claims the browser handler", async () => {
    const mockNas = await startMockNas();
    const fixtureHost = await startFixtureHost(fixturePath);
    const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-e2e-magnet-"));
    const session = await launchExtensionPopup(devBuildPath, { downloadsPath });

    try {
      await seedSettings(session.worker, nasSettings(mockNas.port, { interceptTorrentLinks: false }));
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
      await expect
        .poll(() =>
          page.evaluate(() => document.getElementById("quickget-feedback-host")?.shadowRoot?.textContent ?? ""),
        )
        .toContain("Sent to Download Station");

      // The retired false value is ignored. QuickGet owns the click and invokes the native
      // handler itself only when the NAS hand-off fails. The fixture's bubble listener never
      // runs because the capture listener stops the claimed click immediately.
      const lastClick = await page.evaluate(
        () => (window as unknown as { lastClick?: { defaultPrevented: boolean } }).lastClick,
      );
      expect(lastClick).toBeNull();
    } finally {
      await session.close();
      await fixtureHost.close();
      await mockNas.close();
    }
  });

  test("reloads the extension against a retained page with one current handler", async () => {
    const mockNas = await startMockNas();
    const fixtureHost = await startFixtureHost(fixturePath);
    const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-e2e-magnet-"));
    const session = await launchExtensionPopup(devBuildPath, { downloadsPath });

    try {
      await seedSettings(session.worker, nasSettings(mockNas.port));
      const page = await session.context.newPage();
      await page.goto(fixtureHost.url);

      // Chromium permits the initial command-line load without developer mode, but blocks
      // reloading that unpacked extension unless the temporary profile enables it.
      const manager = await session.context.newPage();
      await manager.goto("chrome://extensions");
      await manager.evaluate(() =>
        (chrome as any).developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }),
      );
      const reloadedWorker = session.context.waitForEvent("serviceworker", { timeout: 15_000 });
      await session.worker.evaluate(() => chrome.runtime.reload());
      await expect
        .poll(() =>
          manager.evaluate(async (id) => {
            const entries = await (chrome as any).developerPrivate.getExtensionsInfo({ includeDisabled: true });
            return entries.find((entry: any) => entry.id === id)?.state;
          }, session.extensionId),
        )
        .toBe("ENABLED");

      // Opening a new extension view wakes the replacement worker. The original site stays
      // open without navigation or test-only executeScript injection.
      const freshPopup = await session.context.newPage();
      await freshPopup.goto(`chrome-extension://${session.extensionId}/src/popup/index.html`, {
        waitUntil: "domcontentloaded",
      });
      const replacementWorker = await reloadedWorker;
      await expect
        .poll(() =>
          replacementWorker.evaluate(async () => {
            const state = await chrome.storage.session.get("quickget:retained-content-scripts-ready");
            return state["quickget:retained-content-scripts-ready"];
          }),
        )
        .toBe(true);
      await manager.close();
      await freshPopup.close();

      await page.click("#magnet-simple");
      await expect
        .poll(
          () =>
            mockNas.requestLog.toJSON().filter((request) => request.path === "/downloadstation/V4/Task/AddUrl").length,
        )
        .toBe(1);
      await expect
        .poll(() =>
          page.evaluate(() => document.getElementById("quickget-feedback-host")?.shadowRoot?.textContent ?? ""),
        )
        .toContain("Sent to Download Station");

      await page.evaluate((url) => {
        const link = document.createElement("a");
        link.id = "retained-file";
        link.href = url;
        link.textContent = "Retained file";
        document.body.appendChild(link);
      }, `${fixtureHost.url}retained.zip`);
      await page.click("#retained-file", { modifiers: ["Shift"] });
      await expect
        .poll(
          () =>
            mockNas.requestLog.toJSON().filter((request) => request.path === "/downloadstation/V4/Task/AddUrl").length,
        )
        .toBe(2);
      await expect
        .poll(() =>
          page.evaluate(() => document.getElementById("quickget-feedback-host")?.shadowRoot?.textContent ?? ""),
        )
        .toContain("Sent to Download Station");
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
    const session = await launchExtensionPopup(devBuildPath, { downloadsPath });

    try {
      await seedSettings(session.worker, nasSettings(mockNas.port));
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

  test("ignores untrusted (synthetic) script clicks for security", async () => {
    const mockNas = await startMockNas();
    const fixtureHost = await startFixtureHost(fixturePath);
    const downloadsPath = await mkdtemp(path.join(tmpdir(), "qg-e2e-magnet-"));
    const session = await launchExtensionPopup(devBuildPath, { downloadsPath });

    try {
      await seedSettings(session.worker, nasSettings(mockNas.port));
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
    const session = await launchExtensionPopup(devBuildPath, { downloadsPath });

    try {
      await seedSettings(session.worker, nasSettings(mockNas.port));
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
