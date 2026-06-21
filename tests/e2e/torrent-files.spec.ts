import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";
import { openSettingsPanel, waitForPopupReady } from "./support/popup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");

test("multi-file torrent selection loads files and saves changed priorities", async () => {
  const mockNas = await startMockNas({
    initialTasks: [
      {
        id: "season-one",
        hash: "season-one",
        name: "Season 01",
        status: "downloading",
        progress: 25,
        sizeBytes: 4_718_592_000,
        downloadedBytes: 1_179_648_000,
        uploadedBytes: 0,
        downSpeedBps: 2_400_000,
        upSpeedBps: 0,
        totalFiles: 3,
      },
    ],
  });
  const session = await launchExtensionPopup(extensionDistPath);
  const { page } = session;

  try {
    await waitForPopupReady(page);
    await openSettingsPanel(page);
    await page.fill("#serverUrl", `http://127.0.0.1:${mockNas.port}`);
    await page.fill("#NASlogin", "demo-user");
    await page.fill("#NASpassword", "demo-password");
    await page.fill("#NAStempdir", "Download");
    await page.fill("#NASdir", "Multimedia/Movies");
    await page.click("#save-btn");
    await page.reload({ waitUntil: "domcontentloaded" });

    const filesButton = page.getByRole("button", { name: "Files (3)" });
    await expect(filesButton).toBeVisible({ timeout: 15_000 });
    await filesButton.click();

    const thirdFile = page.locator(".torrent-files li").filter({ hasText: "Episode 03.mkv" });
    await expect(thirdFile).toBeVisible();
    const thirdFileCheckbox = thirdFile.locator('input[type="checkbox"]');
    await expect(thirdFileCheckbox).not.toBeChecked();
    await thirdFileCheckbox.check();

    const saveButton = page.locator(".torrent-files").getByRole("button", { name: "Save" });
    await saveButton.click();
    await expect(page.locator("#status-message")).toContainText("Updated 1 file");

    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/GetFile")).toBe(true);
    expect(
      mockNas.requestLog
        .toJSON()
        .some(
          (entry) =>
            entry.path === "/downloadstation/V4/Task/SetFile" &&
            new URLSearchParams(entry.requestBody).get("index") === "2" &&
            new URLSearchParams(entry.requestBody).get("priority") === "1",
        ),
    ).toBe(true);
  } finally {
    await session.close();
    await mockNas.close();
  }
});
