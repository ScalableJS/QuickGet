import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { type BrowserContext, chromium, type Page, type Worker } from "@playwright/test";

export interface ExtensionSession {
  context: BrowserContext;
  page: Page;
  extensionId: string;
  /** The MV3 background service worker — `evaluate()` on it reaches the real `chrome.*` APIs. */
  worker: Worker;
  close: () => Promise<void>;
}

export interface LaunchExtensionPopupOptions {
  beforePageLoad?: (context: BrowserContext) => Promise<void> | void;
  /** Where Chrome writes downloads; give tests their own directory. */
  downloadsPath?: string;
  /** Reuse a persistent profile (cookies, logins) instead of a throwaway one. */
  userDataDir?: string;
  headless?: boolean;
}

async function resolveWorker(context: BrowserContext): Promise<Worker> {
  const existing: Worker | undefined = context.serviceWorkers()[0];
  return existing ?? (await context.waitForEvent("serviceworker", { timeout: 15_000 }));
}

function extensionIdFromWorker(worker: Worker): string {
  const url = worker.url();
  const [, , extensionId] = url.split("/");
  if (!extensionId) {
    throw new Error(`Failed to resolve extension id from service worker URL: ${url}`);
  }
  return extensionId;
}

export async function launchExtensionPopup(
  extensionPath: string,
  options: LaunchExtensionPopupOptions = {},
): Promise<ExtensionSession> {
  const userDataDir = options.userDataDir ?? (await mkdtemp(path.join(tmpdir(), "sendtoqnap-e2e-")));

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: options.headless ?? true,
    downloadsPath: options.downloadsPath,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  await options.beforePageLoad?.(context);

  const worker = await resolveWorker(context);
  const extensionId = extensionIdFromWorker(worker);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`, {
    waitUntil: "domcontentloaded",
  });

  return {
    context,
    page,
    extensionId,
    worker,
    close: async () => {
      await context.close();
    },
  };
}
