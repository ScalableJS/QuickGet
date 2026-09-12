import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";
import { openSettingsPanel, switchSettingsTab, waitForPopupReady } from "./support/popup.js";
import { startTestStandHost } from "./support/testStandHost.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixtures arg before testInfo
test("routing rules persist in configured priority order", async ({}, testInfo) => {
  const mockNas = await startMockNas();
  const session = await launchExtensionPopup(extensionDistPath);
  const { page } = session;

  try {
    await waitForPopupReady(page);
    await openSettingsPanel(page);

    await switchSettingsTab(page, "Advanced");
    await expect(page.getByText("No rules yet. All downloads use the Target folder.")).toBeVisible();
    await expect(page.getByText(/Route downloads to folders automatically/)).toBeVisible();

    await switchSettingsTab(page, "Connection");
    await page.fill("#serverUrl", `http://127.0.0.1:${mockNas.port}`);
    await page.fill("#NASlogin", "admin");
    await page.fill("#NASpassword", "local-e2e-password");

    await page.fill("#NAStempdir", "Download");
    await page.press("#NAStempdir", "Escape");
    await page.fill("#NASdir", "Multimedia/Movies");
    await page.press("#NASdir", "Escape");

    await switchSettingsTab(page, "Advanced");
    await page.getByRole("button", { name: "Add rule" }).click();
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(page.locator(".routing-rule")).toHaveCount(2);

    const filenamePatterns = page.getByRole("textbox", { name: /name or extension/i });
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

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixtures arg before testInfo
test("BUG-41 fix: saving rule with empty optional fields succeeds without page errors and preserves UI responsiveness", async ({}, testInfo) => {
  const mockNas = await startMockNas();
  const session = await launchExtensionPopup(extensionDistPath);
  const { page } = session;

  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error);
  });

  try {
    await waitForPopupReady(page);
    await openSettingsPanel(page);

    await switchSettingsTab(page, "Connection");
    await page.fill("#serverUrl", `http://127.0.0.1:${mockNas.port}`);
    await page.fill("#NASlogin", "admin");
    await page.fill("#NASpassword", "local-e2e-password");
    await page.fill("#NAStempdir", "Download");
    await page.press("#NAStempdir", "Escape");
    await page.fill("#NASdir", "Multimedia/Movies");
    await page.press("#NASdir", "Escape");

    await switchSettingsTab(page, "Advanced");
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(page.locator(".routing-rule")).toHaveCount(1);

    // Fill filename pattern and destination, leave domain EMPTY
    const filenamePatterns = page.getByRole("textbox", { name: /name or extension/i });
    await filenamePatterns.nth(0).fill("*.mkv");
    await page.fill("#routing-0-destination", "Multimedia/Movies");

    await page.click("#save-btn");

    // 1. Assert zero runtime errors (no props_invalid_value)
    expect(pageErrors).toEqual([]);

    // 2. Assert saved to storage correctly
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { routingRules } = await chrome.storage.local.get("routingRules");
          return routingRules;
        }),
      )
      .toEqual([{ destination: "Multimedia/Movies", namePattern: "*.mkv" }]);

    // 3. Confirm UI is fully responsive: clicking "Add rule" adds rule #2
    const addRuleBtn = page.getByRole("button", { name: "Add rule" });
    await expect(addRuleBtn).toBeVisible();
    await expect(addRuleBtn).toBeEnabled();
    await addRuleBtn.click();
    await expect(page.locator(".routing-rule")).toHaveCount(2);
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

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixtures arg before testInfo
test("BUG-41/43 fix: saving rule with empty destination displays inline error and retains draft", async ({}, testInfo) => {
  const mockNas = await startMockNas();
  const session = await launchExtensionPopup(extensionDistPath);
  const { page } = session;

  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error);
  });

  try {
    await waitForPopupReady(page);
    await openSettingsPanel(page);

    await switchSettingsTab(page, "Connection");
    await page.fill("#serverUrl", `http://127.0.0.1:${mockNas.port}`);
    await page.fill("#NASlogin", "admin");
    await page.fill("#NASpassword", "local-e2e-password");
    await page.fill("#NAStempdir", "Download");
    await page.press("#NAStempdir", "Escape");
    await page.fill("#NASdir", "Multimedia/Movies");
    await page.press("#NASdir", "Escape");

    await switchSettingsTab(page, "Advanced");
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(page.locator(".routing-rule")).toHaveCount(1);

    // User types a filename pattern but leaves destination empty
    const filenamePatterns = page.getByRole("textbox", { name: /name or extension/i });
    await filenamePatterns.nth(0).fill("*.mkv");
    await expect(page.locator("#routing-0-destination")).toHaveValue("");

    // Click Save
    await page.click("#save-btn");

    // The draft must NOT be dropped! It stays visible on screen with inline error
    await expect(page.locator(".routing-rule")).toHaveCount(1);
    await expect(page.getByText("Destination folder is required")).toBeVisible();
    await expect(page.getByText("Fix the highlighted routing rule errors before saving")).toBeVisible();

    // Transactional assertion: chrome.storage.local was NEVER modified with invalid state
    const storedRules = await page.evaluate(async () => {
      const { routingRules } = await chrome.storage.local.get("routingRules");
      return routingRules ?? [];
    });
    expect(storedRules).toEqual([]);

    // Zero crashes
    expect(pageErrors).toEqual([]);
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

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixtures arg before testInfo
test("reordering rules via Move Up / Move Down buttons updates priority order in storage", async ({}, testInfo) => {
  const mockNas = await startMockNas();
  const session = await launchExtensionPopup(extensionDistPath);
  const { page } = session;

  try {
    await waitForPopupReady(page);
    await openSettingsPanel(page);

    await switchSettingsTab(page, "Connection");
    await page.fill("#serverUrl", `http://127.0.0.1:${mockNas.port}`);
    await page.fill("#NASlogin", "admin");
    await page.fill("#NASpassword", "local-e2e-password");
    await page.fill("#NAStempdir", "Download");
    await page.press("#NAStempdir", "Escape");
    await page.fill("#NASdir", "Multimedia/Movies");
    await page.press("#NASdir", "Escape");

    await switchSettingsTab(page, "Advanced");
    await page.getByRole("button", { name: "Add rule" }).click();
    await page.getByRole("button", { name: "Add rule" }).click();

    const filenamePatterns = page.getByRole("textbox", { name: /name or extension/i });
    await filenamePatterns.nth(0).fill("*.mkv");
    await page.fill("#routing-0-destination", "Multimedia/Movies");

    await filenamePatterns.nth(1).fill("*.iso");
    await page.fill("#routing-1-destination", "Software/ISOs");

    // Rule 1 is *.mkv, Rule 2 is *.iso
    // Move Rule 1 down
    await page.getByRole("button", { name: "Move rule 1 down" }).click();

    // Now Rule 1 should be *.iso and Rule 2 should be *.mkv
    await expect(filenamePatterns.nth(0)).toHaveValue("*.iso");
    await expect(filenamePatterns.nth(1)).toHaveValue("*.mkv");

    await page.click("#save-btn");

    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { routingRules } = await chrome.storage.local.get("routingRules");
          return routingRules;
        }),
      )
      .toEqual([
        { destination: "Software/ISOs", namePattern: "*.iso" },
        { destination: "Multimedia/Movies", namePattern: "*.mkv" },
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

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixtures arg before testInfo
test("live interception on Test Stand routes magnets and downloads to destination matching rules", async ({}, testInfo) => {
  const mockNas = await startMockNas();
  const testStand = await startTestStandHost();
  const session = await launchExtensionPopup(extensionDistPath);
  const { page, worker } = session;

  try {
    await waitForPopupReady(page);

    // Configure NAS settings with routing rules directly in storage
    await worker.evaluate(
      ({ port }) => {
        return chrome.storage.local.set({
          NASaddress: "127.0.0.1",
          NASport: String(port),
          NASsecure: false,
          NASlogin: "admin",
          NASpassword: "demo-password",
          NAStempdir: "Download",
          NASdir: "Multimedia/Default",
          interceptTorrentLinks: true,
          routingRules: [
            { namePattern: "*Director_Cut*", destination: "Routed/Special" },
            { namePattern: "*.mkv", destination: "Routed/Movies" },
            { namePattern: "*Ubuntu*", destination: "Routed/Linux" },
          ],
        });
      },
      { port: mockNas.port },
    );

    // Open the test stand in a new tab
    const standPage = await session.context.newPage();
    await standPage.goto(testStand.url);

    // Switch to Magnets tab
    await standPage.click("#tab-btn-magnets");

    // 1. Click Movie magnet (*.mkv rule)
    await standPage.click("#stand-magnet-movie");

    await expect
      .poll(() => {
        const requests = mockNas.requestLog.toJSON().filter((req) => req.path === "/downloadstation/V4/Task/AddUrl");
        return requests.length;
      })
      .toBeGreaterThanOrEqual(1);

    const movieAddReq = mockNas.requestLog
      .toJSON()
      .find((req) => req.path === "/downloadstation/V4/Task/AddUrl" && req.requestBody?.includes("Documentary.Film"));
    expect(movieAddReq).toBeDefined();
    // Verify destination folder routed to "Routed/Movies" instead of "Multimedia/Default"
    expect(movieAddReq?.requestBody).toContain("move=Routed%2FMovies");

    // 2. Click Ubuntu magnet (*Ubuntu* rule)
    await standPage.click("#stand-magnet-ubuntu");

    await expect
      .poll(() => {
        const requests = mockNas.requestLog
          .toJSON()
          .filter((req) => req.path === "/downloadstation/V4/Task/AddUrl" && req.requestBody?.includes("Ubuntu"));
        return requests.length;
      })
      .toBe(1);

    const ubuntuAddReq = mockNas.requestLog
      .toJSON()
      .find((req) => req.path === "/downloadstation/V4/Task/AddUrl" && req.requestBody?.includes("Ubuntu"));
    expect(ubuntuAddReq?.requestBody).toContain("move=Routed%2FLinux");

    // 3. Click Equals magnet (*Director_Cut* rule verifying BUG-44 fix)
    await standPage.click("#stand-magnet-equals");

    await expect
      .poll(() => {
        const requests = mockNas.requestLog
          .toJSON()
          .filter((req) => req.path === "/downloadstation/V4/Task/AddUrl" && req.requestBody?.includes("Director_Cut"));
        return requests.length;
      })
      .toBe(1);

    const equalsAddReq = mockNas.requestLog
      .toJSON()
      .find((req) => req.path === "/downloadstation/V4/Task/AddUrl" && req.requestBody?.includes("Director_Cut"));
    expect(equalsAddReq?.requestBody).toContain("move=Routed%2FSpecial");
  } catch (error) {
    await testInfo.attach("mock-nas-http-log", {
      body: mockNas.requestLog.toText(),
      contentType: "text/plain",
    });
    throw error;
  } finally {
    await session.close();
    await testStand.close();
    await mockNas.close();
  }
});

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixtures arg before testInfo
test("reloading popup loads stored rules without errors and maintains full draft reactivity", async ({}, testInfo) => {
  const mockNas = await startMockNas();
  const session = await launchExtensionPopup(extensionDistPath);
  const { page } = session;

  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error);
  });

  try {
    // 1. Seed storage with pre-existing rules
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        routingRules: [
          { destination: "Stored/Movies", namePattern: "*.mkv", type: "torrent" },
          { destination: "Stored/Docs", domain: "docs.example.com" },
        ],
      });
    });

    // 2. Reload popup page to test cold hydration from storage
    await page.reload();
    await waitForPopupReady(page);
    await openSettingsPanel(page);
    await switchSettingsTab(page, "Advanced");

    // 3. Confirm 2 rules are rendered in draft state with correct values
    await expect(page.locator(".routing-rule")).toHaveCount(2);
    await expect(page.locator("#routing-0-namePattern")).toHaveValue("*.mkv");
    await expect(page.locator("#routing-0-destination")).toHaveValue("Stored/Movies");
    await expect(page.locator("#routing-1-domain")).toHaveValue("docs.example.com");
    await expect(page.locator("#routing-1-destination")).toHaveValue("Stored/Docs");

    // 4. Confirm no Svelte runtime errors on load
    expect(pageErrors).toEqual([]);

    // 5. Add rule 3 and verify reactivity remains healthy
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(page.locator(".routing-rule")).toHaveCount(3);
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
