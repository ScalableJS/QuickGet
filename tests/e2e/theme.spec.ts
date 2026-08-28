import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");

/**
 * The theme control changed shape, and the change was not visible until Save — which does not
 * run at all while the form is incomplete, so picking a theme appeared to do nothing.
 */
test.describe("theme", () => {
  test.describe.configure({ timeout: 60_000 });

  test("switches the document immediately, and survives a reopen", async () => {
    const nas = await startMockNas();
    const session = await launchExtensionPopup(extensionDistPath);

    try {
      await session.worker.evaluate(
        (values) => chrome.storage.local.set(values as Record<string, unknown>),
        {
          NASaddress: "127.0.0.1",
          NASport: String(nas.port),
          NASlogin: "demo-user",
          NASpassword: "demo-password",
          NAStempdir: "Download",
          NASdir: "Download",
          theme: "light",
        } as Record<string, unknown>,
      );

      await session.page.reload({ waitUntil: "domcontentloaded" });
      await session.page.getByRole("button", { name: "Open settings" }).click();

      const root = session.page.locator("html");
      await expect(root).toHaveAttribute("data-theme", "light");

      await session.page.getByRole("button", { name: "Dark" }).click();
      // The point: no Save in between.
      await expect(root).toHaveAttribute("data-theme", "dark");

      await session.page.getByRole("button", { name: "Light" }).click();
      await expect(root).toHaveAttribute("data-theme", "light");

      // Picking is the commit: no Save is involved, and it survives a reopen.
      await session.page.getByRole("button", { name: "Dark" }).click();
      await expect(session.page.locator("#save-btn")).toBeDisabled();

      await session.page.reload({ waitUntil: "domcontentloaded" });
      await expect(root).toHaveAttribute("data-theme", "dark");
    } finally {
      await session.close();
      await nas.close();
    }
  });
});
