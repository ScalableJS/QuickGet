import { once } from "node:events";
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

test("a reachable NAS with the right password reports ready", async () => {
  const mockNas = await startMockNas({ credentials: { user: FIELDS.login, password: FIELDS.password } });
  const session = await launchExtensionPopup(devBuildPath);
  const { page } = session;

  try {
    await fillConnection(page, `http://127.0.0.1:${mockNas.port}`, FIELDS.password);
    await page.click("#save-btn");

    await expect(page.locator("#status-message")).toHaveText("Connected to the NAS", { timeout: 10_000 });
    // The form gives way to the card, and the card says what the check found.
    await expect(page.locator(".connection-health")).toHaveText("Ready");
  } finally {
    await session.close();
    await mockNas.close();
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
