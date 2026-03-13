import path from "node:path";
import { fileURLToPath } from "node:url";

import { test, expect } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";
import { openSettingsPanel, waitForPopupReady } from "./support/popup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");
const sampleTorrentPath = path.resolve(__dirname, "./fixtures/sample.torrent");

test("popup full cycle: configure, connect, list, control, upload, remove", async ({}, testInfo) => {
  const mockNas = await startMockNas();
  const session = await launchExtensionPopup(extensionDistPath);
  const { page } = session;

  try {
    await waitForPopupReady(page);
    await openSettingsPanel(page);

    await page.fill("#NASaddress", "127.0.0.1");
    await page.fill("#NASport", String(mockNas.port));
    await page.fill("#NASlogin", "admin");
    await page.fill("#NASpassword", "local-e2e-password");
    await page.fill("#NAStempdir", "/share/Download");
    await page.fill("#NASdir", "/share/Multimedia/Movies");

    await page.click("#test-btn");
    await expect(page.locator("#status-message")).toContainText("Connection successful", { timeout: 15_000 });

    await page.click("#save-btn");
    await expect(page.locator("#status-message")).toContainText("Settings saved successfully");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#downloads-list .download-item .download-name").first()).toContainText(
      "Ubuntu ISO",
      { timeout: 15_000 }
    );

    await page.click("#downloads-list .download-item");

    await page.click("#toolbar-stop");
    await expect(page.locator("#status-message")).toContainText("Torrent stopped");

    await page.click("#toolbar-pause");
    await expect(page.locator("#status-message")).toContainText("Torrent paused");

    await page.click("#toolbar-play");
    await expect(page.locator("#status-message")).toContainText("Torrent started");

    await page.setInputFiles("#torrentFileInput", sampleTorrentPath);
    await expect(page.locator("#status-message")).toContainText("Torrent added successfully", {
      timeout: 15_000,
    });

    await expect(page.locator("#downloads-list .download-item .download-name")).toContainText([
      "Ubuntu ISO",
      "sample",
    ]);

    await page.locator("#downloads-list .download-item").filter({ hasText: "sample" }).click();
    await page.click("#toolbar-remove");
    await expect(page.locator("#downloads-list .download-item .download-name")).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(page.locator("#downloads-list .download-item .download-name").first()).toContainText(
      "Ubuntu ISO"
    );

    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Misc/Login")).toBe(true);
    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/Query")).toBe(true);
    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/Stop")).toBe(true);
    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/Pause")).toBe(true);
    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/Start")).toBe(true);
    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/AddTorrent")).toBe(true);
    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/Remove")).toBe(true);
  } catch (error) {
    await testInfo.attach("mock-nas-http-log", {
      body: mockNas.requestLog.toText(),
      contentType: "text/plain",
    });
    throw error;
  } finally {
    await session.close();
    await mockNas.close();
  }
});

