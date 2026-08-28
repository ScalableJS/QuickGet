import path from "node:path";
import { fileURLToPath } from "node:url";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");

/**
 * Runs axe over the real popup rather than a Storybook rendering of it, so what is checked is
 * what ships — including the parts assembled imperatively at runtime.
 *
 * The settings form is the reason this exists: it had no fieldsets, no `aria-invalid` and no
 * association between an error and the field it describes, and nothing would have caught that
 * coming back.
 */
test.describe("accessibility", () => {
  test.describe.configure({ timeout: 60_000 });

  const CONFIGURED = (port: number) => ({
    NASaddress: "127.0.0.1",
    NASport: String(port),
    NASsecure: false,
    NASlogin: "demo-user",
    NASpassword: "demo-password",
    NAStempdir: "Download",
    NASdir: "Multimedia/Movies",
    torrentInterceptMode: "always",
    rememberPassword: true,
    routingRules: [
      { namePattern: "*.mkv", destination: "Multimedia/Movies" },
      { domain: "*.example.com", destination: "Multimedia/Other" },
    ],
  });

  test("the settings form has no detectable violations", async () => {
    const nas = await startMockNas();
    const session = await launchExtensionPopup(extensionDistPath);

    try {
      await session.worker.evaluate(
        (values) => chrome.storage.local.set(values as Record<string, unknown>),
        CONFIGURED(nas.port) as Record<string, unknown>,
      );

      await session.page.reload({ waitUntil: "domcontentloaded" });
      await session.page.getByRole("button", { name: "Open settings" }).click();
      await session.page.waitForSelector("#serverUrl");

      const results = await new AxeBuilder({ page: session.page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(
        results.violations.map((violation) => `${violation.id}: ${violation.help}`),
        "axe violations in the settings form",
      ).toEqual([]);
    } finally {
      await session.close();
      await nas.close();
    }
  });

  test("an incomplete form marks its fields rather than only describing them", async () => {
    const nas = await startMockNas();
    const session = await launchExtensionPopup(extensionDistPath);

    try {
      await session.worker.evaluate(
        (values) => chrome.storage.local.set(values as Record<string, unknown>),
        { ...CONFIGURED(nas.port), NAStempdir: "" } as Record<string, unknown>,
      );

      await session.page.reload({ waitUntil: "domcontentloaded" });
      await session.page.getByRole("button", { name: "Open settings" }).click();
      await session.page.waitForSelector("#serverUrl");

      // Dirty the form so Save is enabled, then try to save an incomplete configuration.
      await session.page.fill("#NASlogin", "demo-user-2");
      await session.page.click("#save-btn");

      // The field itself must carry the state — a status line alone leaves a screen reader
      // user with no way to find which input is wrong.
      const invalid = session.page.locator('[aria-invalid="true"]');
      await expect(invalid.first()).toBeVisible();

      const describedBy = await invalid.first().getAttribute("aria-describedby");
      expect(describedBy, "the invalid field must point at its error message").toBeTruthy();
      await expect(session.page.locator(`#${describedBy}`)).toHaveText(/required/i);
    } finally {
      await session.close();
      await nas.close();
    }
  });
});
