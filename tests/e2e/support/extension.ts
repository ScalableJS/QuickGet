import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium, type BrowserContext, type Page, type Worker } from "@playwright/test";

export interface ExtensionSession {
  context: BrowserContext;
  page: Page;
  extensionId: string;
  close: () => Promise<void>;
}

export interface LaunchExtensionPopupOptions {
  beforePageLoad?: (context: BrowserContext) => Promise<void> | void;
}

async function resolveExtensionId(context: BrowserContext): Promise<string> {
  let worker: Worker | undefined = context.serviceWorkers()[0];
  if (!worker) {
    worker = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  }
  const url = worker.url();
  const [, , extensionId] = url.split("/");
  if (!extensionId) {
    throw new Error(`Failed to resolve extension id from service worker URL: ${url}`);
  }
  return extensionId;
}

export async function launchExtensionPopup(
  extensionPath: string,
  options: LaunchExtensionPopupOptions = {}
): Promise<ExtensionSession> {
  const userDataDir = await mkdtemp(path.join(tmpdir(), "sendtoqnap-e2e-"));

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  await options.beforePageLoad?.(context);

  const extensionId = await resolveExtensionId(context);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`, {
    waitUntil: "domcontentloaded",
  });

  return {
    context,
    page,
    extensionId,
    close: async () => {
      await context.close();
    },
  };
}

