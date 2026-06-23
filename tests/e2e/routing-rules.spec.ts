import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";
import { openSettingsPanel, waitForPopupReady } from "./support/popup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixtures arg before testInfo
test("routing rules save priority and fallback settings", async ({}, testInfo) => {
  const mockNas = await startMockNas();
  const session = await launchExtensionPopup(extensionDistPath);
  const { page } = session;

  try {
    await waitForPopupReady(page);
    await openSettingsPanel(page);

    await expect(page.getByText("No rules yet. All downloads use the Target Folder.")).toBeVisible();
    await expect(page.getByText(/Send matching downloads to a folder automatically/)).toBeVisible();

    await page.fill("#serverUrl", `http://127.0.0.1:${mockNas.port}`);
    await page.fill("#NASlogin", "admin");
    await page.fill("#NASpassword", "local-e2e-password");
    await page.fill("#NAStempdir", "Download");
    await page.fill("#NASdir", "Multimedia/Movies");

    await page.getByRole("button", { name: "Add rule" }).click();
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(page.locator(".routing-rule")).toHaveCount(2);

    const filenamePatterns = page.getByRole("textbox", { name: "Filename pattern" });
    await filenamePatterns.nth(0).fill("*.mkv");
    await page.fill("#routing-0-destination", "Multimedia/Movies");
    await filenamePatterns.nth(1).fill("*.mkv");
    await page.fill("#routing-1-destination", "Multimedia/Series");

    await page.click("#save-btn");

    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { routingRules } = await chrome.storage.local.get("routingRules");
          return routingRules;
        }),
      )
      .toEqual([
        { destination: "Multimedia/Movies", namePattern: "*.mkv" },
        { destination: "Multimedia/Series", namePattern: "*.mkv" },
      ]);
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
