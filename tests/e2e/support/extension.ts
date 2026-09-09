import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
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
  /**
   * Hand downloads back to Chrome instead of letting Playwright manage them.
   *
   * `launchPersistentContext` sends `Browser.setDownloadBehavior` with `allowAndName` at context
   * init (playwright-core `coreBundle.js:37972`). That names every download a GUID and **skips
   * the filename-determination stage entirely**, so `chrome.downloads.onDeterminingFilename`
   * never fires — which is why anything depending on it was untestable and shipped unverified.
   *
   * Undoing it restores native handling: the event fires, and files arrive under their real
   * `Content-Disposition` name. `behavior: "default"` ignores `downloadPath`, so the profile is
   * pointed at `downloadsPath` through its own preferences instead.
   *
   * **Cost:** Playwright's own download plumbing is off in this context — `downloadsPath` and
   * `page.waitForEvent("download")` stop working. Use it only in specs that assert on the
   * directory. The Playwright team consider CDP calls like this out of scope (issue #23776), so
   * an upgrade could break it; it will break loudly.
   */
  nativeDownloads?: boolean;
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

  if (options.nativeDownloads && options.downloadsPath) {
    // Written before launch: Chrome reads this once at startup, and with native handling it is
    // the only thing that decides where a download lands.
    await mkdir(path.join(userDataDir, "Default"), { recursive: true });
    await writeFile(
      path.join(userDataDir, "Default", "Preferences"),
      JSON.stringify({ download: { default_directory: options.downloadsPath, prompt_for_download: false } }),
    );
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: options.headless ?? true,
    downloadsPath: options.downloadsPath,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  if (options.nativeDownloads) {
    const probe = await context.newPage();
    const cdp = await context.newCDPSession(probe);
    await cdp.send("Browser.setDownloadBehavior", { behavior: "default" });
    await cdp.detach();
    await probe.close();
  }

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
