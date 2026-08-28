import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function waitForPopupReady(page: Page): Promise<void> {
  await expect(page.locator("#toolbar-settings")).toBeVisible();
  await expect(page.locator("#downloads-list")).toBeVisible();
}

export async function openSettingsPanel(page: Page): Promise<void> {
  await waitForPopupReady(page);
  const panel = page.locator("#settings-panel");
  if (await panel.isVisible()) return;

  await page.click("#toolbar-settings");
  await expect(panel).toBeVisible({ timeout: 10_000 });
}

/** Settings is tabbed; a field's panel must be active before Playwright can interact with it. */
export async function switchSettingsTab(page: Page, label: "Connection" | "Appearance" | "Advanced"): Promise<void> {
  await page.getByRole("tab", { name: label }).click();
}
