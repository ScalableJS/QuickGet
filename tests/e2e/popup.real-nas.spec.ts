import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { hasRequiredRealNasEnv, loadRealNasEnv } from "./support/e2eEnv.js";
import { launchExtensionPopup } from "./support/extension.js";
import {
  attachHttpCapture,
  installClientSideRequestCapture,
  persistHttpCaptureBundle,
  readClientSideRequestCapture,
} from "./support/httpCapture.js";
import { openSettingsPanel, waitForPopupReady } from "./support/popup.js";
import { cleanupTasksByPrefix, rootDir } from "./support/realNasClient.js";
import { createTorrentFixture } from "./support/torrentFixture.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");
const env = loadRealNasEnv(rootDir);
const ownedTaskPrefix = "quickget-e2e-";

const shouldRunRealNas = env.enabled && hasRequiredRealNasEnv(env);

test.describe("real NAS popup e2e", () => {
  test.skip(!shouldRunRealNas, "Real NAS E2E is disabled. Set QNAP_E2E_REAL=1 locally to enable it.");

  test("read-only smoke: settings, connection, and list rendering", async ({ browserName: _browserName }, testInfo) => {
    const session = await launchExtensionPopup(extensionDistPath, {
      beforePageLoad: (context) => installClientSideRequestCapture(context, env.host, env.port),
    });
    const { page, context } = session;
    const httpLog = attachHttpCapture(context, env.host, env.port);

    try {
      await waitForPopupReady(page);
      await openSettingsPanel(page);
      await page.fill("#NASaddress", env.host);
      await page.fill("#NASport", env.port);
      await page.fill("#NASlogin", env.login);
      await page.fill("#NASpassword", env.password);
      await page.fill("#NAStempdir", env.tempDir);
      await page.fill("#NASdir", env.destDir);

      if (env.secure) {
        await page.check("#NASsecure");
      } else {
        await page.uncheck("#NASsecure");
      }

      await page.click("#test-btn");
      await expect(page.locator("#status-message")).toContainText("Connection successful", {
        timeout: 20_000,
      });

      await page.click("#save-btn");
      await expect(page.locator("#status-message")).toContainText("Settings saved successfully");

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForPopupReady(page);
      await expect(page.locator("#downloads-list")).not.toContainText("Popup initialization failed", {
        timeout: 20_000,
      });
      await expect(page.locator("#downloads-list")).not.toBeEmpty({ timeout: 20_000 });

      if (env.captureHttp) {
        httpLog.mergeRequestBodies(await readClientSideRequestCapture(page));
        await persistHttpCaptureBundle(rootDir, "real-nas-smoke", httpLog);
      }
    } catch (error) {
      await testInfo.attach("real-nas-http-log", {
        body: httpLog.toText(),
        contentType: "text/plain",
      });
      throw error;
    } finally {
      await session.close();
    }
  });

  test("@mutating upload and remove only suite-owned torrent", async ({ browserName: _browserName }, testInfo) => {
    test.skip(!env.allowMutations, "Mutating real NAS E2E is disabled. Set QNAP_E2E_ALLOW_MUTATIONS=1 locally.");

    const fixture = await createTorrentFixture(ownedTaskPrefix.slice(0, -1));
    const session = await launchExtensionPopup(extensionDistPath, {
      beforePageLoad: (context) => installClientSideRequestCapture(context, env.host, env.port),
    });
    const { page, context } = session;
    const httpLog = attachHttpCapture(context, env.host, env.port);

    try {
      await cleanupTasksByPrefix(env, ownedTaskPrefix);

      await waitForPopupReady(page);
      await openSettingsPanel(page);
      await page.fill("#NASaddress", env.host);
      await page.fill("#NASport", env.port);
      await page.fill("#NASlogin", env.login);
      await page.fill("#NASpassword", env.password);
      await page.fill("#NAStempdir", env.tempDir);
      await page.fill("#NASdir", env.destDir);

      if (env.secure) {
        await page.check("#NASsecure");
      } else {
        await page.uncheck("#NASsecure");
      }

      await page.click("#save-btn");
      await expect(page.locator("#status-message")).toContainText("Settings saved successfully");

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForPopupReady(page);
      await page.setInputFiles("#torrentFileInput", fixture.torrentFilePath);
      await expect(page.locator("#status-message")).toContainText("Torrent added successfully", {
        timeout: 20_000,
      });

      const ownedItem = page.locator("#downloads-list .download-item").filter({
        hasText: fixture.displayName,
      });
      await expect(ownedItem).toHaveCount(1, { timeout: 20_000 });
      await ownedItem.click();
      await page.click("#toolbar-remove");

      await expect(ownedItem).toHaveCount(0, { timeout: 20_000 });

      if (env.captureHttp) {
        httpLog.mergeRequestBodies(await readClientSideRequestCapture(page));
        await persistHttpCaptureBundle(rootDir, "real-nas-mutating", httpLog);
      }
    } catch (error) {
      await testInfo.attach("real-nas-http-log", {
        body: httpLog.toText(),
        contentType: "text/plain",
      });
      throw error;
    } finally {
      await cleanupTasksByPrefix(env, ownedTaskPrefix);
      await fixture.cleanup();
      await session.close();
    }
  });
});
