import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");

/**
 * An uncaught error in the popup is invisible unless someone happens to have DevTools open on
 * it, which nobody does. This surfaces them as a test failure instead.
 */
test.describe("popup console", () => {
  test.describe.configure({ timeout: 60_000 });

  test("opening the popup and the settings raises no page errors", async () => {
    const nas = await startMockNas();
    const session = await launchExtensionPopup(extensionDistPath);
    const problems: string[] = [];

    session.page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
    session.page.on("console", (message) => {
      if (message.type() === "error") problems.push(`console.error: ${message.text()}`);
    });

    try {
      await session.worker.evaluate((values) => chrome.storage.local.set(values as Record<string, unknown>), {
        NASaddress: "127.0.0.1",
        NASport: String(nas.port),
        NASlogin: "demo-user",
        NASpassword: "demo-password",
        NAStempdir: "Download",
        NASdir: "Download",
      } as Record<string, unknown>);

      await session.page.reload({ waitUntil: "domcontentloaded" });
      await session.page.getByRole("button", { name: "Open settings" }).click();
      await session.page.getByRole("button", { name: "Edit" }).click();
      await session.page.waitForSelector("#serverUrl");
      await session.page.waitForTimeout(1500);

      expect(problems, "the popup logged errors").toEqual([]);
    } finally {
      await session.close();
      await nas.close();
    }
  });
});
