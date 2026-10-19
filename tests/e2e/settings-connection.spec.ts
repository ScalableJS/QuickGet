import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

import { expect, test } from "@playwright/test";

import { devBuildPath } from "./support/builds.js";
import { launchExtensionPopup } from "./support/extension.js";
import { startMockNas } from "./support/mockNas.js";
import { openSettingsPanel, switchSettingsTab, waitForPopupReady } from "./support/popup.js";

/**
 * The three answers the connection test can give, driven through the real settings screen.
 *
 * BUG-40 was not that the verdict was wrong — it was that it arrived up to thirty seconds late,
 * behind a button still reading "Saving…", after a green "Settings saved" that turned red. So
 * these specs assert the clock and the wording as much as the outcome.
 */

const FIELDS = {
  login: "admin",
  password: "local-e2e-password",
  temp: "Download",
  target: "Multimedia/Movies",
};

async function fillConnection(page: import("@playwright/test").Page, serverUrl: string, password: string) {
  await waitForPopupReady(page);
  await openSettingsPanel(page);
  await switchSettingsTab(page, "Connection");

  await page.fill("#serverUrl", serverUrl);
  await page.fill("#NASlogin", FIELDS.login);
  await page.fill("#NASpassword", password);
  await page.fill("#NAStempdir", FIELDS.temp);
  await page.press("#NAStempdir", "Escape");
  await page.fill("#NASdir", FIELDS.target);
  await page.press("#NASdir", "Escape");
}

/**
 * Accepts the connection and then says nothing at all — a NAS whose host is awake enough to
 * complete a TCP handshake but not to answer, which is what a sleeping disk or a half-started
 * Download Station looks like from the browser. This is the case that used to hang: there is no
 * refusal to react to, so without a deadline the wait is the browser's to end.
 */
async function startSilentHost(): Promise<{ port: number; close: () => Promise<void> }> {
  const sockets = new Set<import("node:net").Socket>();
  const server = createServer(() => {
    // Deliberately no response.
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("silent host did not get a port");

  return {
    port: address.port,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      server.close();
      await once(server, "close");
    },
  };
}

test("Enter in the NAS password saves settings and reports the connection result", async () => {
  const mockNas = await startMockNas({ credentials: { user: FIELDS.login, password: FIELDS.password } });
  const session = await launchExtensionPopup(devBuildPath);
  const { page } = session;

  try {
    await fillConnection(page, `http://127.0.0.1:${mockNas.port}`, FIELDS.password);
    await page.press("#NASpassword", "Enter");

    await expect(page.locator("#status-message")).toHaveText("Connected to the NAS", { timeout: 10_000 });
    // The form gives way to the card, and the card says what the check found.
    await expect(page.locator(".connection-health")).toHaveText("Ready");
  } finally {
    await session.close();
    await mockNas.close();
  }
});

test("Save highlights every empty connection field before parsing the server address", async () => {
  const session = await launchExtensionPopup(devBuildPath);
  const { page } = session;

  try {
    await waitForPopupReady(page);
    await openSettingsPanel(page);
    await switchSettingsTab(page, "Connection");
    await page.locator("#serverUrl").focus();
    await page.locator("#NASlogin").focus();
    await page.fill("#NASpassword", "local-e2e-password");
    await expect(page.locator("#serverUrl")).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#NASlogin")).not.toHaveAttribute("aria-invalid", "true");
    await page.click("#save-btn");

    for (const id of ["serverUrl", "NASlogin"]) {
      await expect(page.locator(`#${id}`)).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator(`#${id}-error`)).toContainText("required");
      const errorColor = await page.locator(`#${id}-error`).evaluate((message) => getComputedStyle(message).color);
      await expect(page.locator(`#${id}`), `${id} needs a visible error border, including while focused`).toHaveCSS(
        "border-top-color", errorColor,
      );
    }
    await expect(page.locator("#serverUrl")).toBeFocused();
    await expect(page.locator("#status-message")).toHaveText("Fill in the highlighted fields before saving");
    expect(await session.worker.evaluate(() => chrome.storage.local.get("NASpassword"))).toEqual({});

    await page.fill("#serverUrl", "http://[");
    await page.fill("#NASlogin", FIELDS.login);
    await expect(page.locator("#NASlogin")).not.toHaveAttribute("aria-invalid", "true");
    await page.press("#NASpassword", "Enter");
    await expect(page.locator("#serverUrl-error")).toContainText("Invalid server address");
    await expect(page.locator("#serverUrl")).toBeFocused();
    expect(await session.worker.evaluate(() => chrome.storage.local.get("NASlogin"))).toEqual({});
  } finally {
    await session.close();
  }
});

test("a wrong password is named as a wrong password, not as a network problem", async () => {
  const mockNas = await startMockNas({ credentials: { user: FIELDS.login, password: FIELDS.password } });
  const session = await launchExtensionPopup(devBuildPath);
  const { page } = session;

  try {
    await fillConnection(page, `http://127.0.0.1:${mockNas.port}`, "not-the-password");

    const startedAt = Date.now();
    await page.click("#save-btn");

    await expect(page.locator("#status-message")).toHaveText(
      "The NAS rejected the username or password. Check them in Settings.",
      { timeout: 10_000 },
    );
    await expect(page.locator(".connection-health")).toHaveText("Authentication failed");

    // Two login attempts against a NAS that answers immediately; the retry with the raw password
    // is part of the budget, not on top of it.
    expect(Date.now() - startedAt).toBeLessThan(10_000);
  } finally {
    await session.close();
    await mockNas.close();
  }
});

test("an absent NAS answers within the budget, and never holds the Save button hostage", async () => {
  // A port that was listening a moment ago and is not any more: a connection there is refused or
  // dropped, which is what a NAS that is switched off looks like.
  const vanished = await startMockNas();
  const deadPort = vanished.port;
  await vanished.close();

  const session = await launchExtensionPopup(devBuildPath);
  const { page } = session;

  try {
    await fillConnection(page, `http://127.0.0.1:${deadPort}`, FIELDS.password);

    const startedAt = Date.now();
    await page.click("#save-btn");

    // The save itself is a write to browser storage and is over in milliseconds. The settings are
    // stored and the button is back before the network has said anything — the regression BUG-40
    // was about. Asserted on the button and on storage rather than on the status pill, which the
    // background task poller also writes to and can win a race for.
    await expect
      .poll(() => page.evaluate(async () => (await chrome.storage.local.get("NASlogin")).NASlogin), {
        timeout: 3_000,
      })
      .toBe(FIELDS.login);
    await expect(page.locator("#save-btn")).not.toHaveText("Saving…");
    expect(Date.now() - startedAt).toBeLessThan(3_000);

    await expect(page.locator(".connection-health")).toHaveText("NAS unreachable", { timeout: 10_000 });
    await expect(page.locator(".connection-detail")).toContainText(`127.0.0.1:${deadPort}`);
    // The card keeps the saved settings and says so, rather than sending the user back to a form.
    await expect(page.locator(".connection-card")).toContainText("Saved connection settings still active.");

    // The point of the fix: a verdict on our schedule. Before it, this took 10-30 s.
    expect(Date.now() - startedAt).toBeLessThan(15_000);
  } finally {
    await session.close();
  }
});

test("a NAS that accepts the connection and then goes quiet is given up on, not waited out", async () => {
  const silent = await startSilentHost();
  const session = await launchExtensionPopup(devBuildPath);
  const { page } = session;

  try {
    await fillConnection(page, `http://127.0.0.1:${silent.port}`, FIELDS.password);

    const startedAt = Date.now();
    await page.click("#save-btn");

    // The one place the intermediate state can be observed without racing anything: nothing else
    // can report a failure first, because every other request to this host hangs too. "Saved" is
    // stated, and the green success is withheld until the check has spoken.
    await expect(page.locator("#status-message")).toHaveText("Settings saved — checking the NAS…", { timeout: 3_000 });

    await expect(page.locator(".connection-health")).toHaveText("NAS unreachable", { timeout: 12_000 });
    await expect(page.locator(".connection-detail")).toContainText("did not answer within 5 s");

    const elapsed = Date.now() - startedAt;
    // The budget, plus room for the popup to render it. Without one the browser decides, and its
    // answer is measured in tens of seconds.
    expect(elapsed).toBeLessThan(12_000);
    expect(elapsed).toBeGreaterThan(4_000);
  } finally {
    await session.close();
    await silent.close();
  }
});


test("an exported backup restores the NAS endpoint, username and folders in a fresh profile", async () => {
  const mockNas = await startMockNas({ credentials: { user: FIELDS.login, password: FIELDS.password } });
  const source = await launchExtensionPopup(devBuildPath);
  const restored = await launchExtensionPopup(devBuildPath);
  const serverUrl = `http://127.0.0.1:${mockNas.port}`;

  try {
    await fillConnection(source.page, serverUrl, FIELDS.password);
    await source.page.click("#save-btn");
    await expect(source.page.locator(".connection-health")).toHaveText("Ready");
    await switchSettingsTab(source.page, "Advanced");
    const pendingDownload = source.page.waitForEvent("download");
    await source.page.getByRole("button", { name: "Export settings" }).click();
    const download = await pendingDownload;
    const backupPath = await download.path();
    if (!backupPath) throw new Error("Export did not produce a local backup file");
    const backup = await readFile(backupPath, "utf8");
    const expected = {
      NASaddress: "127.0.0.1",
      NASport: String(mockNas.port),
      NASsecure: false,
      NASlogin: FIELDS.login,
      NAStempdir: FIELDS.temp,
      NASdir: FIELDS.target,
    };
    expect(JSON.parse(backup).settings).toMatchObject(expected);
    expect(JSON.parse(backup).settings).not.toHaveProperty("NASpassword");

    await waitForPopupReady(restored.page);
    await openSettingsPanel(restored.page);
    await switchSettingsTab(restored.page, "Advanced");
    await restored.page.setInputFiles("#import-input", {
      name: "quickget-settings.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup),
    });
    await switchSettingsTab(restored.page, "Connection");
    await expect(restored.page.locator("#serverUrl")).toHaveValue(serverUrl);
    await expect(restored.page.locator("#NASlogin")).toHaveValue(FIELDS.login);
    await expect(restored.page.locator("#NAStempdir")).toHaveValue(FIELDS.temp);
    await expect(restored.page.locator("#NASdir")).toHaveValue(FIELDS.target);
    await expect(restored.page.locator("#NASpassword")).toHaveValue("");

    await restored.page.fill("#NASpassword", FIELDS.password);
    await restored.page.press("#NASpassword", "Enter");
    await expect(restored.page.locator(".connection-health")).toHaveText("Ready");
    expect(await restored.worker.evaluate(() => chrome.storage.local.get(null))).toMatchObject(expected);
    await restored.page.reload({ waitUntil: "domcontentloaded" });
    await waitForPopupReady(restored.page);
    await openSettingsPanel(restored.page);
    await expect(restored.page.locator(".connection-card")).toContainText(`${FIELDS.login}@127.0.0.1`);
    await restored.page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(restored.page.locator("#serverUrl")).toHaveValue(serverUrl);
    await expect(restored.page.locator("#NASdir")).toHaveValue(FIELDS.target);
  } finally {
    await source.close();
    await restored.close();
    await mockNas.close();
  }
});


test("Enter confirms the folder picker without saving the settings form", async () => {
  const mockNas = await startMockNas({ credentials: { user: FIELDS.login, password: FIELDS.password } });
  const session = await launchExtensionPopup(devBuildPath);
  const { page } = session;

  try {
    await fillConnection(page, `http://127.0.0.1:${mockNas.port}`, FIELDS.password);
    await page.fill("#NAStempdir", "Down");
    await expect(page.getByRole("option", { name: "Download", exact: true })).toBeVisible();
    await page.press("#NAStempdir", "ArrowDown");
    await page.press("#NAStempdir", "Enter");
    await expect(page.locator("#NAStempdir")).toHaveValue("Download");
    await expect(page.locator("#save-btn")).toBeEnabled();
    expect(await session.worker.evaluate(() => chrome.storage.local.get("NASaddress"))).toEqual({});

    await page.press("#NAStempdir", "ArrowDown");
    await expect(page.locator("#NAStempdir")).toHaveAttribute("aria-expanded", "true");
    await page.press("#NAStempdir", "Enter");
    await expect(page.locator("#NAStempdir")).toHaveAttribute("aria-expanded", "false");
    expect(await session.worker.evaluate(() => chrome.storage.local.get("NASaddress"))).toEqual({});

    await page.press("#NASpassword", "Enter");
    await expect(page.locator(".connection-health")).toHaveText("Ready");
  } finally {
    await session.close();
    await mockNas.close();
  }
});
