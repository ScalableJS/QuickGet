import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import type { Task } from "../../src/lib/tasks.js";

import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";
import { openSettingsPanel, switchSettingsTab, waitForPopupReady } from "./support/popup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDistPath = path.resolve(__dirname, "../../dist");
const sampleTorrentPath = path.resolve(__dirname, "./fixtures/sample.torrent");

test("popup renders the QNAP transition states with their official meaning", async () => {
  const statuses = [
    { name: "Queued check task", status: "queuedChecking" },
    { name: "Checking task", status: "checking" },
    { name: "Metadata task", status: "downloadingMetadata" },
    { name: "Downloading task", status: "downloading" },
    { name: "Moving task", status: "moving" },
    { name: "Allocating task", status: "allocating" },
    { name: "Seeding task", status: "seeding" },
    { name: "Error disk full task", status: "error", errorCode: 20488 },
  ] as const;
  const initialTasks: Task[] = statuses.map(({ name, status, ...rest }, index) => ({
    id: `status-${index}`,
    hash: `status-${index}`,
    name,
    status,
    progress: status === "seeding" ? 100 : 42,
    sizeBytes: 1_000,
    downloadedBytes: status === "seeding" ? 1_000 : 420,
    uploadedBytes: 0,
    downSpeedBps: status === "downloading" ? 100 : 0,
    upSpeedBps: 0,
    seeds: status === "downloading" ? { connected: 12, total: 30 } : undefined,
    peers: status === "downloading" ? { connected: 4, total: 10 } : undefined,
    errorCode: "errorCode" in rest ? (rest.errorCode as number) : undefined,
    source: "qnap",
  }));
  const mockNas = await startMockNas({ initialTasks });
  const session = await launchExtensionPopup(extensionDistPath);

  try {
    await session.worker.evaluate((values) => chrome.storage.local.set(values), {
      NASaddress: "127.0.0.1",
      NASport: String(mockNas.port),
      NASsecure: false,
      NASlogin: "admin",
      NASpassword: "local-e2e-password",
      NAStempdir: "Download",
      NASdir: "Multimedia/Movies",
    });
    await session.page.reload({ waitUntil: "domcontentloaded" });
    await waitForPopupReady(session.page);
    await session.page.getByRole("button", { name: "All" }).click();

    for (const { name, status } of statuses) {
      const expected = {
        queuedChecking: "Queued for checking",
        checking: "Checking",
        downloadingMetadata: "Downloading metadata",
        downloading: "Downloading",
        moving: "Moving",
        allocating: "Allocating",
        seeding: "Seeding",
        error: "Not enough disk space on NAS",
      }[status];
      await expect(session.page.locator(".download-item").filter({ hasText: name })).toContainText(expected);
    }

    // Verify rich card telemetry: swarm metrics and byte progress (BUG-35, BUG-36)
    const downloadCard = session.page.locator(".download-item").filter({ hasText: "Downloading task" });
    await expect(downloadCard).toContainText("S 12 · P 4");
    await expect(downloadCard).toContainText("420 B / 1000 B");

    // Verify error taxonomy (BUG-37)
    const errorCard = session.page.locator(".download-item").filter({ hasText: "Error disk full task" });
    await expect(errorCard).toContainText("Not enough disk space on NAS");
  } finally {
    await session.close();
    await mockNas.close();
  }
});

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixtures arg before testInfo
test("popup full cycle: configure, connect, list, control, upload, remove", async ({}, testInfo) => {
  const mockNas = await startMockNas({ removeDelayMs: 250 });
  const session = await launchExtensionPopup(extensionDistPath);
  const { page } = session;

  try {
    await waitForPopupReady(page);
    await openSettingsPanel(page);
    await expect(page.locator("#toolbar-settings")).toHaveAttribute("aria-label", "Back to downloads");

    await switchSettingsTab(page, "Advanced");
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(page.locator(".routing-rule")).toHaveCount(1);
    await expect(page.locator("#routing-0-destination")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          clientHeight: document.body.clientHeight,
          scrollHeight: document.body.scrollHeight,
          toolbarPosition: getComputedStyle(document.querySelector("header.toolbar") ?? document.body).position,
        })),
      )
      .toMatchObject({ clientHeight: 600, toolbarPosition: "sticky" });
    expect(await page.evaluate(() => document.body.scrollHeight > document.body.clientHeight)).toBe(true);

    await switchSettingsTab(page, "Connection");
    await page.fill("#serverUrl", `http://127.0.0.1:${mockNas.port}`);
    await page.fill("#NASlogin", "admin");
    await page.fill("#NASpassword", "local-e2e-password");

    // Relative to the share root — DS rejects absolute /share/... paths (error 4096).
    await page.fill("#NAStempdir", "Download");
    // The picker opens its listbox on focus and would cover the next field.
    await page.press("#NAStempdir", "Escape");
    await page.fill("#NASdir", "Multimedia/Movies");
    await page.press("#NASdir", "Escape");

    const queryCountBeforeSave = mockNas.requestLog
      .toJSON()
      .filter((entry) => entry.path.includes("/downloadstation/V4/Task/Query")).length;
    await page.click("#save-btn");
    await expect(page.locator("#save-btn")).toBeDisabled();
    await expect
      .poll(
        () =>
          mockNas.requestLog.toJSON().filter((entry) => entry.path.includes("/downloadstation/V4/Task/Query")).length,
      )
      .toBeGreaterThan(queryCountBeforeSave);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#downloads-list .download-item .download-name").first()).toContainText("Ubuntu ISO", {
      timeout: 15_000,
    });
    await expect.poll(() => page.evaluate(() => document.body.getBoundingClientRect().height)).toBeLessThan(600);

    await page.click("#downloads-list .download-item");

    await page.click("#toolbar-stop");
    await expect(page.locator("#status-message")).toContainText("Torrent stopped");

    await page.click("#toolbar-pause");
    await expect(page.locator("#status-message")).toContainText("Torrent paused");

    await page.click("#toolbar-play");
    await expect(page.locator("#status-message")).toContainText("Torrent started");

    await page.setInputFiles("#torrentFileInput", sampleTorrentPath);
    await page.getByRole("button", { name: "All" }).click();
    await expect(page.locator("#downloads-list .download-item .download-name")).toContainText(["Ubuntu ISO", "sample"]);

    await page.locator("#downloads-list .download-item").filter({ hasText: "sample" }).click();
    await page.click("#toolbar-remove");
    await expect(page.locator("#downloads-list .download-item").filter({ hasText: "sample" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(page.locator("#downloads-list .download-item .download-name")).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(page.locator("#downloads-list .download-item .download-name").first()).toContainText("Ubuntu ISO");

    await page.locator("#downloads-list .download-item").filter({ hasText: "Ubuntu ISO" }).click();
    await page.getByRole("button", { name: "More remove options" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("menuitem", { name: "Remove task and files…" }).click();
    await expect(page.locator("#downloads-list .download-item")).toHaveCount(0, { timeout: 15_000 });
    await expect
      .poll(() =>
        mockNas.requestLog
          .toJSON()
          .filter((entry) => entry.path.includes("/downloadstation/V4/Task/Remove"))
          .some((entry) => new URLSearchParams(entry.requestBody).get("clean") === "1"),
      )
      .toBe(true);

    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Misc/Login")).toBe(true);
    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/Query")).toBe(true);
    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/Stop")).toBe(true);
    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/Pause")).toBe(true);
    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/Start")).toBe(true);
    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/AddTorrent")).toBe(true);
    expect(mockNas.requestLog.includesPath("/downloadstation/V4/Task/Remove")).toBe(true);
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
