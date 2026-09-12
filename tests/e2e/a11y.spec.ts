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
    interceptTorrentLinks: true,
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

      // A configured connection shows a card, not inputs — check that state first.
      await expect(session.page.getByRole("button", { name: "Test connection" })).toBeVisible();

      const cardResults = await new AxeBuilder({ page: session.page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        cardResults.violations.map((violation) => `${violation.id}: ${violation.help}`),
        "axe violations on the connection card",
      ).toEqual([]);

      // Then the form behind Edit, which is where the inputs live.
      await session.page.getByRole("button", { name: "Edit" }).click();
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

  /**
   * The tab panels that are not open carry the `hidden` attribute, and axe skips hidden
   * subtrees — so seeding `routingRules` into storage proved nothing while the pass never left
   * the Connection tab. The rule cards had therefore never been scanned at all.
   */
  test("the routing rules on the Advanced tab have no detectable violations", async () => {
    const nas = await startMockNas();
    const session = await launchExtensionPopup(extensionDistPath);

    try {
      await session.worker.evaluate(
        (values) => chrome.storage.local.set(values as Record<string, unknown>),
        CONFIGURED(nas.port) as Record<string, unknown>,
      );

      await session.page.reload({ waitUntil: "domcontentloaded" });
      await session.page.getByRole("button", { name: "Open settings" }).click();
      await session.page.getByRole("tab", { name: "Advanced" }).click();
      await session.page.waitForSelector("#routing-0-namePattern");

      const valid = await new AxeBuilder({ page: session.page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        valid.violations.map((violation) => `${violation.id}: ${violation.help}`),
        "axe violations on the routing rules",
      ).toEqual([]);

      // Then the same panel with a rule in an error state — the markup that only exists after a
      // rejected save, and the markup BUG-48 was about.
      await session.page.fill("#routing-0-destination", "");
      await session.page.fill("#routing-0-namePattern", "");
      await session.page.click("#save-btn");
      await expect(session.page.locator("#routing-0-destination")).toHaveAttribute("aria-invalid", "true");

      const invalid = await new AxeBuilder({ page: session.page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        invalid.violations.map((violation) => `${violation.id}: ${violation.help}`),
        "axe violations on a rejected routing rule",
      ).toEqual([]);
    } finally {
      await session.close();
      await nas.close();
    }
  });

  /**
   * Reordering is the only way to change rule priority, and the control that performs it is
   * disabled the moment the rule reaches an end — at which point the browser drops focus to
   * the document body unless something puts it back.
   */
  test("reordering a rule with the keyboard keeps focus inside the rule that moved", async () => {
    const nas = await startMockNas();
    const session = await launchExtensionPopup(extensionDistPath);

    try {
      await session.worker.evaluate(
        (values) => chrome.storage.local.set(values as Record<string, unknown>),
        CONFIGURED(nas.port) as Record<string, unknown>,
      );

      await session.page.reload({ waitUntil: "domcontentloaded" });
      await session.page.getByRole("button", { name: "Open settings" }).click();
      await session.page.getByRole("tab", { name: "Advanced" }).click();
      await session.page.waitForSelector("#routing-1-move-up");

      // Rule 2 to the top: the Move Up button it was activated from becomes disabled.
      await session.page.focus("#routing-1-move-up");
      await session.page.keyboard.press("Enter");

      const focusedId = await session.page.evaluate(() => document.activeElement?.id ?? "");
      expect(focusedId, "focus must not fall out of the rule that moved").toMatch(/^routing-0-move-/);

      const announcement = session.page.locator("#status-message");
      await expect(announcement).toHaveText(/moved up/i);
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
        // An unset username, not an unset folder: the folder now has a working default, so an
        // empty one is no longer reachable.
        { ...CONFIGURED(nas.port), NASlogin: "" } as Record<string, unknown>,
      );

      await session.page.reload({ waitUntil: "domcontentloaded" });
      await session.page.getByRole("button", { name: "Open settings" }).click();
      // An incomplete connection shows the form directly, with no card in front of it.
      await session.page.waitForSelector("#serverUrl");

      // Dirty the form so Save is enabled, then try to save while a required field is empty.
      await session.page.fill("#NASpassword", "another-password");
      await session.page.click("#save-btn");

      // The field itself must carry the state — a status line alone leaves a screen reader
      // user with no way to find which input is wrong. Asserted on the empty field by name:
      // the folder pickers on this tab also report validity, against the NAS rather than the
      // form, and picking "the first invalid thing" would silently test the wrong one.
      const invalid = session.page.locator("#NASlogin");
      await expect(invalid).toHaveAttribute("aria-invalid", "true");

      const describedBy = await invalid.getAttribute("aria-describedby");
      expect(describedBy, "the invalid field must point at its error message").toBeTruthy();
      await expect(session.page.locator(`#${describedBy}`)).toHaveText(/required/i);
    } finally {
      await session.close();
      await nas.close();
    }
  });

  /**
   * Save has to reach a field that is not on screen. `focus()` into a hidden panel silently
   * does nothing, which would reproduce the original complaint exactly: press Save, watch
   * nothing happen. Here the user is on Advanced when the empty field is on Connection.
   */
  test("Save switches to the tab holding the first invalid field", async () => {
    const nas = await startMockNas();
    const session = await launchExtensionPopup(extensionDistPath);

    try {
      await session.worker.evaluate(
        (values) => chrome.storage.local.set(values as Record<string, unknown>),
        CONFIGURED(nas.port) as Record<string, unknown>,
      );

      await session.page.reload({ waitUntil: "domcontentloaded" });
      await session.page.getByRole("button", { name: "Open settings" }).click();

      // Empty the folder the way a user would — the default means it cannot be seeded empty.
      await session.page.getByRole("button", { name: "Edit" }).click();
      await session.page.fill("#NAStempdir", "");

      // Then walk away to a tab that does not contain it.
      await session.page.getByRole("tab", { name: "Advanced" }).click();
      await expect(session.page.getByRole("tab", { name: "Advanced" })).toHaveAttribute("aria-selected", "true");

      await session.page.click("#save-btn");

      await expect(session.page.getByRole("tab", { name: "Connection" })).toHaveAttribute("aria-selected", "true");
      await expect(session.page.locator("#NAStempdir")).toBeFocused();
      await expect(session.page.locator("#NAStempdir")).toHaveAttribute("aria-invalid", "true");
    } finally {
      await session.close();
      await nas.close();
    }
  });

  /**
   * Importing used to overwrite the form the moment a file was picked. A file chosen from disk
   * is opaque to the user, so the confirmation both asks first and says what will change.
   */
  test("an imported backup is not applied until it is confirmed", async () => {
    const nas = await startMockNas();
    const session = await launchExtensionPopup(extensionDistPath);

    try {
      await session.worker.evaluate(
        (values) => chrome.storage.local.set(values as Record<string, unknown>),
        CONFIGURED(nas.port) as Record<string, unknown>,
      );

      await session.page.reload({ waitUntil: "domcontentloaded" });
      await session.page.getByRole("button", { name: "Open settings" }).click();
      await session.page.getByRole("tab", { name: "Advanced" }).click();

      const backup = JSON.stringify({
        settings: { NASaddress: "imported.local", NASlogin: "imported-user", theme: "dark" },
      });
      await session.page.setInputFiles("#import-input", {
        name: "quickget-settings.json",
        mimeType: "application/json",
        buffer: Buffer.from(backup),
      });

      // Named, not merely announced: the user is told which settings the file will replace.
      const warning = session.page.getByText(/This will overwrite current settings/);
      await expect(warning).toBeVisible();
      await expect(warning).toContainText("Server address");
      await expect(warning).toContainText("Username");

      // Cancelling must leave the form exactly as it was.
      await session.page.getByRole("button", { name: "Cancel" }).click();
      await session.page.getByRole("tab", { name: "Connection" }).click();
      await session.page.getByRole("button", { name: "Edit" }).click();
      await expect(session.page.locator("#NASlogin")).toHaveValue("demo-user");

      // Confirming applies it — still only to the form, which Save then persists.
      await session.page.getByRole("tab", { name: "Advanced" }).click();
      await session.page.setInputFiles("#import-input", {
        name: "quickget-settings.json",
        mimeType: "application/json",
        buffer: Buffer.from(backup),
      });
      await session.page.getByRole("button", { name: "Replace settings" }).click();

      await session.page.getByRole("tab", { name: "Connection" }).click();
      await expect(session.page.locator("#NASlogin")).toHaveValue("imported-user");
    } finally {
      await session.close();
      await nas.close();
    }
  });

  /**
   * The interception setting has two states, so it is a checkbox. It used to be a two-item
   * select on a tab of its own — a menu to discover that the alternative was "off".
   */
  test("interception is one checkbox on the connection tab, and it persists", async () => {
    const nas = await startMockNas();
    const session = await launchExtensionPopup(extensionDistPath);

    try {
      await session.worker.evaluate(
        (values) => chrome.storage.local.set(values as Record<string, unknown>),
        CONFIGURED(nas.port) as Record<string, unknown>,
      );

      await session.page.reload({ waitUntil: "domcontentloaded" });
      await session.page.getByRole("button", { name: "Open settings" }).click();
      await session.page.getByRole("button", { name: "Edit" }).click();

      // One switch now: `.torrent` downloads and magnet clicks were two Chrome APIs for the
      // same intent, and whether a local copy survives is a browser capability rather than a
      // preference. The two checkboxes that used to sit here are gone.
      const intercept = session.page.locator("#interceptTorrentLinks");
      await expect(intercept).toBeChecked();
      await expect(session.page.getByLabel("Don't save .torrent locally")).toHaveCount(0);
      await expect(session.page.getByLabel("Intercept magnet links")).toHaveCount(0);

      // The gesture that makes the switch low-stakes has to be stated, or nobody finds it.
      await expect(intercept).toHaveAccessibleDescription(/Hold Shift/);

      await intercept.uncheck();
      await session.page.click("#save-btn");

      const stored = await session.worker.evaluate(
        async () => (await chrome.storage.local.get("interceptTorrentLinks")).interceptTorrentLinks,
      );
      expect(stored).toBe(false);
    } finally {
      await session.close();
      await nas.close();
    }
  });

  test("a settings-password error marks and focuses its field", async () => {
    const nas = await startMockNas();
    const session = await launchExtensionPopup(extensionDistPath);

    try {
      await session.worker.evaluate(
        (values) => chrome.storage.local.set(values as Record<string, unknown>),
        CONFIGURED(nas.port) as Record<string, unknown>,
      );

      await session.page.reload({ waitUntil: "domcontentloaded" });
      await session.page.getByRole("button", { name: "Open settings" }).click();
      await session.page.getByRole("tab", { name: "Advanced" }).click();
      await session.page.getByLabel("Lock settings with password").check();
      await session.page.getByLabel("Settings password", { exact: true }).fill("short");
      await session.page.getByRole("button", { name: "Save settings" }).click();

      const password = session.page.getByLabel("Settings password", { exact: true });
      await expect(password).toHaveAttribute("aria-invalid", "true");
      await expect(password).toBeFocused();
      await expect(session.page.getByText("Use at least 8 characters")).toBeVisible();
    } finally {
      await session.close();
      await nas.close();
    }
  });
});
