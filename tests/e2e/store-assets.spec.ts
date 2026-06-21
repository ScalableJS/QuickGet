import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";
import { openSettingsPanel, waitForPopupReady } from "./support/popup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");
const assetPath = path.resolve(__dirname, "../../store-assets/.cache");

test("capture Chrome Web Store screenshots with mock NAS data", async () => {
  const mockNas = await startMockNas({
    initialTasks: [
      {
        id: "ubuntu-iso",
        name: "Ubuntu 24.04 LTS.iso",
        status: "downloading",
        progress: 68,
        sizeBytes: 5_900_000_000,
        downloadedBytes: 4_012_000_000,
        uploadedBytes: 0,
        downSpeedBps: 4_200_000,
        upSpeedBps: 52_000,
        etaSec: 442,
      },
      {
        id: "open-source-archive",
        name: "Open source archive.torrent",
        status: "seeding",
        progress: 100,
        sizeBytes: 1_400_000_000,
        downloadedBytes: 1_400_000_000,
        uploadedBytes: 368_000_000,
        downSpeedBps: 0,
        upSpeedBps: 328_000,
      },
    ],
  });
  const session = await launchExtensionPopup(extensionDistPath);
  const { page } = session;

  try {
    await page.setViewportSize({ width: 460, height: 700 });
    await waitForPopupReady(page);
    await openSettingsPanel(page);
    await page.fill("#serverUrl", `http://127.0.0.1:${mockNas.port}`);
    await page.fill("#NASlogin", "demo-user");
    await page.fill("#NASpassword", "demo-password");
    await page.fill("#NAStempdir", "Download");
    await page.fill("#NASdir", "Multimedia/Movies");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(assetPath, "settings.png") });

    await page.click("#save-btn");
    await expect(page.locator("#downloads-list .download-item")).toHaveCount(1, { timeout: 15_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#downloads-list .download-item")).toHaveCount(1, { timeout: 15_000 });
    await page.screenshot({ path: path.join(assetPath, "downloads.png") });
  } finally {
    await session.close();
    await mockNas.close();
  }
});
