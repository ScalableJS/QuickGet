import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";
import { openSettingsPanel, waitForPopupReady } from "./support/popup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");
const assetPath = path.resolve(__dirname, "../../store-assets/.cache-dark");

test("capture Chrome Web Store screenshots (dark theme) with mock NAS data", async () => {
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
  const { page, worker } = session;

  try {
    await worker.evaluate((settings) => chrome.storage.local.set(settings), {
      NASaddress: "127.0.0.1",
      NASport: String(mockNas.port),
      NASsecure: false,
      NASlogin: "demo-user",
      NASpassword: "demo-password",
      NAStempdir: "Download",
      NASdir: "Multimedia/Movies",
      theme: "dark",
    });
    // Chrome lets the popup grow with its content up to 600px.
    await page.setViewportSize({ width: 450, height: 600 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForPopupReady(page);
    await openSettingsPanel(page);
    await page.getByRole("button", { name: "Edit" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(assetPath, "settings.png") });

    await page.getByRole("button", { name: "Back to downloads" }).click();
    await expect(page.locator("#downloads-list .download-item")).toBeVisible({ timeout: 15_000 });
    const downloadsHeight = await page.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
    await page.setViewportSize({ width: 450, height: downloadsHeight });
    await page.screenshot({ path: path.join(assetPath, "downloads.png") });
  } finally {
    await session.close();
    await mockNas.close();
  }
});
