import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import type { Task } from "../../src/lib/tasks.js";

import { devBuildPath } from "./support/builds.js";
import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";
import { openSettingsPanel, waitForPopupReady } from "./support/popup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleTorrentPath = path.resolve(__dirname, "./fixtures/sample.torrent");
const queryRoute = "**/downloadstation/V4/Task/Query";

const task: Task = {
  id: "feedback-task",
  hash: "feedback-task",
  name: "Feedback marker",
  status: "downloading",
  progress: 10,
  sizeBytes: 100,
  downloadedBytes: 10,
  uploadedBytes: 0,
  downSpeedBps: 1,
  upSpeedBps: 0,
  source: "qnap",
};

async function seedNas(worker: import("@playwright/test").Worker, port: number): Promise<void> {
  await worker.evaluate(
    (nasPort) =>
      chrome.storage.local.set({
        NASaddress: "127.0.0.1",
        NASport: String(nasPort),
        NASsecure: false,
        NASlogin: "admin",
        NASpassword: "fixture-password",
        NAStempdir: "Download",
        NASdir: "Download",
      }),
    port,
  );
}

test("poll recovery uses the popup response, renders the recovered row, and clears only poll feedback", async () => {
  const mockNas = await startMockNas({ initialTasks: [task] });
  const session = await launchExtensionPopup(devBuildPath);

  try {
    await seedNas(session.worker, mockNas.port);
    await session.page.route(queryRoute, (route) => route.abort("failed"));
    await session.page.reload({ waitUntil: "domcontentloaded" });

    await expect(session.page.locator("#status-message")).toContainText("Failed to list downloads");
    await expect(session.page.locator(".download-item")).toHaveCount(0);

    const recovered = session.page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/downloadstation/V4/Task/Query" && response.status() === 200,
    );
    await session.page.unroute(queryRoute);
    expect((await recovered).status()).toBe(200);

    await expect(session.page.locator(".download-name")).toHaveText("Feedback marker");
    await expect(session.page.locator(".status-bar")).toBeHidden();
  } finally {
    await session.close();
    await mockNas.close();
  }
});

for (const command of [
  { endpoint: "Start", button: "#toolbar-play", failure: "Failed to start download", success: "Download started" },
  { endpoint: "Stop", button: "#toolbar-stop", failure: "Failed to stop download", success: "Download stopped" },
  { endpoint: "Pause", button: "#toolbar-pause", failure: "Failed to pause download", success: "Download paused" },
] as const) {
  test(`rejected ${command.endpoint} has one terminal error and a retry succeeds`, async () => {
    const mockNas = await startMockNas({ initialTasks: [task] });
    const session = await launchExtensionPopup(devBuildPath);
    const pageErrors: string[] = [];
    session.page.on("pageerror", (error) => pageErrors.push(error.message));

    try {
      await seedNas(session.worker, mockNas.port);
      await session.page.reload({ waitUntil: "domcontentloaded" });
      await waitForPopupReady(session.page);
      const card = session.page.locator(".download-item").filter({ hasText: "Feedback marker" });
      await expect(card).toBeVisible();
      await card.click();

      let rejectedRequests = 0;
      const route = `**/downloadstation/V4/Task/${command.endpoint}`;
      await session.page.route(route, async (intercept) => {
        rejectedRequests += 1;
        await intercept.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ error: 6, reason: "Denied" }),
        });
      });

      await session.page.click(command.button);
      await expect(session.page.locator("#status-message")).toContainText(command.failure);
      expect(rejectedRequests).toBe(1);
      expect(pageErrors).toEqual([]);

      await session.page.unroute(route);
      await session.page.click(command.button);
      await expect(session.page.locator("#status-message")).toHaveText(command.success);
      expect(rejectedRequests).toBe(1);
    } finally {
      await session.close();
      await mockNas.close();
    }
  });
}

test("unsupported Pause reports the actual successful Stop fallback", async () => {
  const mockNas = await startMockNas({ initialTasks: [task] });
  const session = await launchExtensionPopup(devBuildPath);
  const pageErrors: string[] = [];
  session.page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await seedNas(session.worker, mockNas.port);
    await session.page.reload({ waitUntil: "domcontentloaded" });
    await waitForPopupReady(session.page);
    await session.page.locator(".download-item").filter({ hasText: "Feedback marker" }).click();

    let pauses = 0;
    let stops = 0;
    await session.page.route("**/downloadstation/V4/Task/Pause", async (route) => {
      pauses += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ error: 2, reason: "no such api" }),
      });
    });
    await session.page.route("**/downloadstation/V4/Task/Stop", async (route) => {
      stops += 1;
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ error: 0 }) });
    });

    await session.page.click("#toolbar-pause");
    await expect(session.page.locator("#status-message")).toHaveText("Download stopped");
    expect(pauses).toBe(1);
    expect(stops).toBe(1);
    expect(pageErrors).toEqual([]);
  } finally {
    await session.close();
    await mockNas.close();
  }
});

test("a rejected Stop fallback names the Stop outcome", async () => {
  const mockNas = await startMockNas({ initialTasks: [task] });
  const session = await launchExtensionPopup(devBuildPath);
  const pageErrors: string[] = [];
  session.page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await seedNas(session.worker, mockNas.port);
    await session.page.reload({ waitUntil: "domcontentloaded" });
    await waitForPopupReady(session.page);
    await session.page.locator(".download-item").filter({ hasText: "Feedback marker" }).click();

    let pauses = 0;
    let stops = 0;
    await session.page.route("**/downloadstation/V4/Task/Pause", async (route) => {
      pauses += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ error: 2, reason: "no such api" }),
      });
    });
    await session.page.route("**/downloadstation/V4/Task/Stop", async (route) => {
      stops += 1;
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ error: 6, reason: "Denied" }) });
    });

    await session.page.click("#toolbar-pause");
    await expect(session.page.locator("#status-message")).toContainText("Failed to stop download");
    expect(pauses).toBe(1);
    expect(stops).toBe(1);
    expect(pageErrors).toEqual([]);
  } finally {
    await session.close();
    await mockNas.close();
  }
});

test("a transport-rejected Stop fallback still names the Stop outcome", async () => {
  const mockNas = await startMockNas({ initialTasks: [task] });
  const session = await launchExtensionPopup(devBuildPath);
  const pageErrors: string[] = [];
  session.page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await seedNas(session.worker, mockNas.port);
    await session.page.reload({ waitUntil: "domcontentloaded" });
    await waitForPopupReady(session.page);
    await session.page.locator(".download-item").filter({ hasText: "Feedback marker" }).click();

    let pauses = 0;
    let stops = 0;
    await session.page.route("**/downloadstation/V4/Task/Pause", async (route) => {
      pauses += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ error: 2, reason: "no such api" }),
      });
    });
    await session.page.route("**/downloadstation/V4/Task/Stop", async (route) => {
      stops += 1;
      await route.abort("failed");
    });

    await session.page.click("#toolbar-pause");
    await expect(session.page.locator("#status-message")).toHaveText("Failed to stop download: Failed to fetch");
    expect(pauses).toBe(1);
    expect(stops).toBe(1);
    expect(pageErrors).toEqual([]);
  } finally {
    await session.close();
    await mockNas.close();
  }
});

test("poll failures cannot replace settings or upload feedback", async () => {
  const mockNas = await startMockNas({ initialTasks: [task] });
  const session = await launchExtensionPopup(devBuildPath);

  try {
    await seedNas(session.worker, mockNas.port);
    await session.page.reload({ waitUntil: "domcontentloaded" });
    await waitForPopupReady(session.page);

    let failedPolls = 0;
    await session.page.route(queryRoute, async (route) => {
      failedPolls += 1;
      await route.abort("failed");
    });
    await expect.poll(() => failedPolls).toBeGreaterThan(0);

    await openSettingsPanel(session.page);
    await session.page.getByRole("button", { name: "Test connection" }).click();
    await expect(session.page.locator("#status-message")).toHaveText("Connected to the NAS");
    const pollsBeforeUpload = failedPolls;
    await expect.poll(() => failedPolls).toBeGreaterThan(pollsBeforeUpload);
    await expect(session.page.locator("#status-message")).toHaveText("Connected to the NAS");

    await session.page.getByRole("button", { name: "Back to downloads" }).click();
    await session.page.setInputFiles("#torrentFileInput", sampleTorrentPath);
    await expect(session.page.locator("#status-message")).toContainText('Added "sample.torrent" to Download Station');
    const pollsBeforeAssertion = failedPolls;
    await expect.poll(() => failedPolls).toBeGreaterThan(pollsBeforeAssertion);
    await expect(session.page.locator("#status-message")).toContainText('Added "sample.torrent" to Download Station');
  } finally {
    await session.close();
    await mockNas.close();
  }
});

test("pending upload feedback neither expires nor yields to poll health", async () => {
  const mockNas = await startMockNas({ initialTasks: [task] });
  const session = await launchExtensionPopup(devBuildPath);
  const pageErrors: string[] = [];
  session.page.on("pageerror", (error) => pageErrors.push(error.message));
  let releaseUpload = () => {};

  try {
    await seedNas(session.worker, mockNas.port);
    await session.page.reload({ waitUntil: "domcontentloaded" });
    await waitForPopupReady(session.page);
    await session.page.clock.install();

    let uploadReached!: () => void;
    const uploadStarted = new Promise<void>((resolve) => {
      uploadReached = resolve;
    });
    const uploadGate = new Promise<void>((resolve) => {
      releaseUpload = resolve;
    });
    await session.page.route("**/downloadstation/V4/Task/AddTorrent", async (route) => {
      uploadReached();
      await uploadGate;
      await route.continue();
    });

    let failedPolls = 0;
    await session.page.route(queryRoute, async (route) => {
      failedPolls += 1;
      await route.abort("failed");
    });
    await session.page.setInputFiles("#torrentFileInput", sampleTorrentPath);
    await uploadStarted;
    await expect(session.page.locator("#status-message")).toHaveText("Uploading torrent: sample.torrent...");
    await session.page.clock.fastForward(4000);
    await expect.poll(() => failedPolls).toBeGreaterThan(0);
    await expect(session.page.locator("#status-message")).toHaveText("Uploading torrent: sample.torrent...");

    releaseUpload();
    await expect(session.page.locator("#status-message")).toContainText('Added "sample.torrent" to Download Station');
    expect(pageErrors).toEqual([]);
  } finally {
    releaseUpload();
    await session.close();
    await mockNas.close();
  }
});

test("plain Settings saved expires, while a dismissed poll episode stays quiet until recovery", async () => {
  const mockNas = await startMockNas({ initialTasks: [task] });
  const session = await launchExtensionPopup(devBuildPath);

  try {
    await seedNas(session.worker, mockNas.port);
    await session.page.reload({ waitUntil: "domcontentloaded" });
    await waitForPopupReady(session.page);
    await session.page.clock.install();
    await openSettingsPanel(session.page);
    await session.page.getByRole("button", { name: "Test connection" }).click();
    await expect(session.page.locator("#status-message")).toHaveText("Connected to the NAS");
    await session.page.clock.fastForward(2500);
    await expect(session.page.locator(".status-bar")).toBeHidden();

    await session.page.getByRole("button", { name: "Edit" }).click();
    await session.page.fill("#NASdir", "Download/Verified");
    await session.page.click("#save-btn");
    await expect(session.page.locator("#status-message")).toHaveText("Settings saved");
    await session.page.clock.fastForward(2500);
    await expect(session.page.locator(".status-bar")).toBeHidden();

    await session.page.getByRole("button", { name: "Back to downloads" }).click();
    let failures = 0;
    await session.page.route(queryRoute, async (route) => {
      failures += 1;
      await route.abort("failed");
    });
    await session.page.clock.fastForward(2000);
    await expect.poll(() => failures).toBeGreaterThan(0);
    await expect(session.page.locator("#status-message")).toContainText("Failed to list downloads");
    await session.page.locator("#status-dismiss").focus();
    await session.page.keyboard.press("Enter");
    await expect(session.page.locator(".status-bar")).toBeHidden();
    const dismissedFailures = failures;
    await session.page.clock.fastForward(4000);
    await expect.poll(() => failures).toBeGreaterThan(dismissedFailures);
    await expect(session.page.locator(".status-bar")).toBeHidden();

    const recovered = session.page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/downloadstation/V4/Task/Query" && response.status() === 200,
    );
    await session.page.unroute(queryRoute);
    await recovered;
    await expect(session.page.locator(".download-name")).toHaveText("Feedback marker");
  } finally {
    await session.close();
    await mockNas.close();
  }
});

test("saving a replacement connection invalidates an older poll and renders only the new NAS rows", async () => {
  const firstNas = await startMockNas({ initialTasks: [{ ...task, name: "First NAS marker" }] });
  const secondNas = await startMockNas({
    initialTasks: [
      { ...task, name: "Second NAS marker", hash: "second" },
      { ...task, name: "Second NAS extra", hash: "second-extra" },
    ],
  });
  const session = await launchExtensionPopup(devBuildPath);
  const pageErrors: string[] = [];
  session.page.on("pageerror", (error) => pageErrors.push(error.message));

  let releaseFirstQuery = () => {};
  let releaseFirstStart = () => {};

  try {
    await seedNas(session.worker, firstNas.port);
    await session.page.reload({ waitUntil: "domcontentloaded" });
    await waitForPopupReady(session.page);
    await session.page.locator(".download-item").filter({ hasText: "First NAS marker" }).click();
    await session.page.clock.install();

    let firstQueryReached!: () => void;
    const firstQueryGate = new Promise<void>((resolve) => {
      releaseFirstQuery = resolve;
    });
    const reached = new Promise<void>((resolve) => {
      firstQueryReached = resolve;
    });
    const firstQuerySettled = new Promise<void>((resolve) => {
      const settle = () => {
        session.page.off("requestfailed", onRequestFailed);
        session.page.off("requestfinished", onRequestFinished);
        resolve();
      };
      const onRequestFailed = (request: import("@playwright/test").Request) => {
        if (request.url().includes(`:${firstNas.port}/downloadstation/V4/Task/Query`)) settle();
      };
      const onRequestFinished = (request: import("@playwright/test").Request) => {
        if (request.url().includes(`:${firstNas.port}/downloadstation/V4/Task/Query`)) settle();
      };
      session.page.on("requestfailed", onRequestFailed);
      session.page.on("requestfinished", onRequestFinished);
    });
    await session.page.route("**/downloadstation/V4/Task/Query", async (route) => {
      if (route.request().url().includes(`:${firstNas.port}/`)) {
        firstQueryReached();
        await firstQueryGate;
      }
      await route.continue();
    });
    await session.page.clock.fastForward(2000);
    await reached;

    let firstStartReached!: () => void;
    const firstStart = new Promise<void>((resolve) => {
      firstStartReached = resolve;
    });
    const firstStartGate = new Promise<void>((resolve) => {
      releaseFirstStart = resolve;
    });
    await session.page.route("**/downloadstation/V4/Task/Start", async (route) => {
      if (route.request().url().includes(`:${firstNas.port}/`)) {
        firstStartReached();
        await firstStartGate;
      }
      await route.continue();
    });
    const firstStartResponse = session.page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/downloadstation/V4/Task/Start" && response.url().includes(`:${firstNas.port}/`),
    );
    await session.page.click("#toolbar-play");
    await firstStart;

    await openSettingsPanel(session.page);
    await session.page.getByRole("button", { name: "Edit" }).click();
    await session.page.fill("#serverUrl", `http://127.0.0.1:${secondNas.port}`);
    await session.page.click("#save-btn");
    await expect(session.page.locator("#status-message")).toHaveText("Connected to the NAS");
    await expect(session.page.locator(".download-name").first()).toHaveText("Second NAS marker");
    await expect(session.page.locator(".download-item")).toHaveCount(2);
    await expect.poll(() => session.worker.evaluate(() => chrome.action.getBadgeText({}))).toBe("2");

    releaseFirstQuery();
    releaseFirstStart();
    await firstQuerySettled;
    await (await firstStartResponse).finished();
    await expect(session.page.locator(".download-name").first()).toHaveText("Second NAS marker");
    await expect(session.page.locator(".download-item")).toHaveCount(2);
    await expect.poll(() => session.worker.evaluate(() => chrome.action.getBadgeText({}))).toBe("2");
    await expect(session.page.locator("#status-message")).toHaveText("Connected to the NAS");
    expect(pageErrors).toEqual([]);
  } finally {
    releaseFirstQuery();
    releaseFirstStart();
    await session.close();
    await firstNas.close();
    await secondNas.close();
  }
});

test("removing a connection clears old rows and selection before pending A work settles", async () => {
  const mockNas = await startMockNas({ initialTasks: [task] });
  const session = await launchExtensionPopup(devBuildPath);
  const pageErrors: string[] = [];
  session.page.on("pageerror", (error) => pageErrors.push(error.message));

  let releaseQuery = () => {};
  let releaseStart = () => {};
  try {
    await seedNas(session.worker, mockNas.port);
    await session.page.reload({ waitUntil: "domcontentloaded" });
    await waitForPopupReady(session.page);
    await session.page.locator(".download-item").click();
    await session.page.clock.install();

    let queryReached!: () => void;
    const queryStarted = new Promise<void>((resolve) => {
      queryReached = resolve;
    });
    const querySettled = new Promise<void>((resolve) => {
      const settle = () => {
        session.page.off("requestfailed", onRequestFailed);
        session.page.off("requestfinished", onRequestFinished);
        resolve();
      };
      const onRequestFailed = (request: import("@playwright/test").Request) => {
        if (new URL(request.url()).pathname === "/downloadstation/V4/Task/Query") settle();
      };
      const onRequestFinished = (request: import("@playwright/test").Request) => {
        if (new URL(request.url()).pathname === "/downloadstation/V4/Task/Query") settle();
      };
      session.page.on("requestfailed", onRequestFailed);
      session.page.on("requestfinished", onRequestFinished);
    });
    const queryGate = new Promise<void>((resolve) => {
      releaseQuery = resolve;
    });
    await session.page.route(queryRoute, async (route) => {
      queryReached();
      await queryGate;
      await route.continue();
    });
    await session.page.clock.fastForward(2000);
    await queryStarted;

    let startReached!: () => void;
    const startStarted = new Promise<void>((resolve) => {
      startReached = resolve;
    });
    const startGate = new Promise<void>((resolve) => {
      releaseStart = resolve;
    });
    await session.page.route("**/downloadstation/V4/Task/Start", async (route) => {
      startReached();
      await startGate;
      await route.continue();
    });
    const startResponse = session.page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/downloadstation/V4/Task/Start",
    );
    await session.page.click("#toolbar-play");
    await startStarted;

    await openSettingsPanel(session.page);
    session.page.once("dialog", (dialog) => dialog.accept());
    await session.page.getByRole("button", { name: "Remove connection" }).click();
    await expect(session.page.locator("#status-message")).toHaveText("Connection removed");
    await expect(session.page.locator(".download-item")).toHaveCount(0);
    await expect(session.page.locator("#toolbar-play")).toBeDisabled();

    releaseQuery();
    releaseStart();
    await querySettled;
    await (await startResponse).finished();
    await expect(session.page.locator(".download-item")).toHaveCount(0);
    await expect(session.page.locator("#status-message")).toHaveText("Connection removed");
    expect(pageErrors).toEqual([]);
  } finally {
    releaseQuery();
    releaseStart();
    await session.close();
    await mockNas.close();
  }
});

test("closing and reopening the popup discards the old pending query", async () => {
  const mockNas = await startMockNas({ initialTasks: [task] });
  const session = await launchExtensionPopup(devBuildPath);
  let releaseOldQuery = () => {};

  try {
    await seedNas(session.worker, mockNas.port);
    await session.page.reload({ waitUntil: "domcontentloaded" });
    await waitForPopupReady(session.page);
    await session.page.clock.install();

    let oldQueryReached!: () => void;
    const oldQueryStarted = new Promise<void>((resolve) => {
      oldQueryReached = resolve;
    });
    const oldQueryGate = new Promise<void>((resolve) => {
      releaseOldQuery = resolve;
    });
    let holdOldQuery = true;
    await session.page.route(queryRoute, async (route) => {
      if (holdOldQuery) {
        oldQueryReached();
        await oldQueryGate;
      }
      await route.continue();
    });
    await session.page.clock.fastForward(2000);
    await oldQueryStarted;

    await session.page.close();
    holdOldQuery = false;
    const reopened = await session.context.newPage();
    await reopened.goto(`chrome-extension://${session.extensionId}/src/popup/index.html`, { waitUntil: "domcontentloaded" });
    await waitForPopupReady(reopened);
    await expect(reopened.locator(".download-name")).toHaveText("Feedback marker");

    releaseOldQuery();
    await expect(reopened.locator(".download-name")).toHaveText("Feedback marker");
  } finally {
    releaseOldQuery();
    await session.close();
    await mockNas.close();
  }
});
