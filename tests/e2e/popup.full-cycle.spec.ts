import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";
import { openSettingsPanel, waitForPopupReady } from "./support/popup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");
const sampleTorrentPath = path.resolve(__dirname, "./fixtures/sample.torrent");

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixtures arg before testInfo
test("popup full cycle: configure, connect, list, control, upload, remove", async ({}, testInfo) => {
  const mockNas = await startMockNas({ removeDelayMs: 250 });
  const session = await launchExtensionPopup(extensionDistPath);
  const { page } = session;

  try {
    await waitForPopupReady(page);
    await openSettingsPanel(page);
    await expect(page.locator("#toolbar-settings")).toHaveAttribute("aria-label", "Back to downloads");

    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(page.locator(".routing-rule")).toHaveCount(1);
    await expect(page.locator("#routing-0-destination")).toBeVisible();

    await page.fill("#serverUrl", `http://127.0.0.1:${mockNas.port}`);
    await page.fill("#NASlogin", "admin");
    await page.fill("#NASpassword", "local-e2e-password");
    // Relative to the share root — DS rejects absolute /share/... paths (error 4096).
    await page.fill("#NAStempdir", "Download");
    await page.fill("#NASdir", "Multimedia/Movies");

    const queryCountBeforeSave = mockNas.requestLog
      .toJSON()
      .filter((entry) => entry.path.includes("/downloadstation/V4/Task/Query")).length;
    await page.click("#save-btn");
    await expect(page.locator("#save-btn")).toBeDisabled();
    await expect
      .poll(
        () =>
          mockNas.requestLog.toJSON().filter((entry) => entry.path.includes("/downloadstation/V4/Task/Query")).length,
      )
      .toBeGreaterThan(queryCountBeforeSave);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#downloads-list .download-item .download-name").first()).toContainText("Ubuntu ISO", {
      timeout: 15_000,
    });

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

    await page.getByRole("button", { name: "All" }).click();
    await expect(page.locator("#downloads-list .download-item .download-name")).toContainText(["Ubuntu ISO", "sample"]);

    await page.locator("#downloads-list .download-item").filter({ hasText: "sample" }).click();
    await page.click("#toolbar-remove");
    await expect(page.locator("#downloads-list .download-item").filter({ hasText: "sample" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(page.locator("#downloads-list .download-item .download-name")).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(page.locator("#downloads-list .download-item .download-name").first()).toContainText("Ubuntu ISO");

    await page.locator("#downloads-list .download-item").filter({ hasText: "Ubuntu ISO" }).click();
    await page.getByRole("button", { name: "More remove options" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("menuitem", { name: "Remove task and files…" }).click();
    await expect(page.locator("#downloads-list .download-item")).toHaveCount(0, { timeout: 15_000 });
    await expect
      .poll(() =>
        mockNas.requestLog
          .toJSON()
          .filter((entry) => entry.path.includes("/downloadstation/V4/Task/Remove"))
          .some((entry) => new URLSearchParams(entry.requestBody).get("clean") === "1"),
      )
      .toBe(true);

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
