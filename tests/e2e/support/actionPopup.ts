import type { BrowserContext, Page, Worker } from "@playwright/test";

/**
 * Opens the **real** action popup — the one hanging off the toolbar icon — rather than
 * `popup.html` in a tab, which is what `launchExtensionPopup()` gives you.
 *
 * The distinction only matters for the promo recording (see `demo-video-kanban.md`, DEMO-5):
 * a native window capture films the browser chrome, so the popup must be the genuine surface.
 * Playwright cannot click the toolbar, but it does not need to — `chrome.action.openPopup()`
 * (Chrome 127+) performs the real action operation itself, which is both more reliable than a
 * coordinate click and a stronger assertion.
 *
 * The window is focused first: an action popup closes the moment it loses focus, so nothing may
 * steal focus while the shot is held.
 *
 * This is a *harness* capability. The extension never calls `openPopup()` itself, so the
 * manifest's `minimum_chrome_version` is unaffected.
 */
export async function openActionPopup(worker: Worker): Promise<void> {
  await worker.evaluate(async () => {
    const target = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
    if (target.id === undefined) throw new Error("No normal Chrome window to open the popup in");

    await chrome.windows.update(target.id, { focused: true });
    await chrome.action.openPopup({ windowId: target.id });
  });
}

/**
 * Waits until the action popup is actually open, and returns its target URL.
 *
 * **Playwright never surfaces this popup as a `Page`** — verified: after `openPopup()` the
 * context still reports only its ordinary tabs, and `chrome.extension.getViews()` is not
 * available from an MV3 service worker. The popup does exist as a CDP target though: a
 * `page` target on the extension origin appears only after the call, so that is what we
 * assert on.
 *
 * Consequence for the demo spec: the popup's *contents* cannot be asserted through Playwright
 * locators. Assert the underlying state instead (task list via the mock NAS, badge text via
 * `chrome.action`), and let the video show the rendering.
 */
export async function waitForActionPopupTarget(
  context: BrowserContext,
  page: Page,
  extensionId: string,
  timeout = 10_000,
): Promise<string> {
  const cdp = await context.newCDPSession(page);
  const deadline = Date.now() + timeout;

  try {
    while (Date.now() < deadline) {
      const { targetInfos } = await cdp.send("Target.getTargets");
      const popup = targetInfos.find(
        (target) => target.type === "page" && target.url.startsWith(`chrome-extension://${extensionId}/`),
      );
      if (popup) return popup.url;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } finally {
    await cdp.detach().catch(() => {});
  }

  throw new Error(`Action popup did not open within ${timeout}ms`);
}

/** The popup's own CSS size (`src/popup/styles/base.css`) — a window sized to this looks right. */
export const POPUP_SIZE = { width: 450, height: 600 } as const;

/**
 * Opens the popup in a **popup-type window** sized like the real one, centred over the browser.
 *
 * For the settings beats the action popup is unusable — it closes the moment focus moves, and the
 * form needs typing. The obvious fallback, a normal tab, films badly: the address bar shows
 * `chrome-extension://…/index.html` and a 450px popup stretches across a 1920px window, leaving
 * most of the frame empty. A popup-type window has no address bar and keeps the product's real
 * proportions.
 *
 * Returns the created window's id so the caller can close it before the toolbar beat.
 */
export async function openPopupWindow(
  worker: Worker,
  extensionId: string,
  frame: { left: number; top: number; width: number; height: number },
): Promise<number> {
  const bounds = {
    left: Math.round(frame.left + (frame.width - POPUP_SIZE.width) / 2),
    top: Math.round(frame.top + (frame.height - POPUP_SIZE.height) / 2),
    ...POPUP_SIZE,
  };

  return worker.evaluate(
    async ({ id, box }) => {
      const created = await chrome.windows.create({
        url: `chrome-extension://${id}/src/popup/index.html`,
        type: "popup",
        focused: true,
        ...box,
      });
      if (created?.id === undefined) throw new Error("Failed to open the popup window");

      // `windows.create` does not reliably honour left/top — the first take landed the window in
      // the corner despite correct arithmetic. Re-apply the geometry once it exists.
      await chrome.windows.update(created.id, box);
      return created.id;
    },
    { id: extensionId, box: bounds },
  );
}

/** Closes a window opened by `openPopupWindow`. */
export async function closePopupWindow(worker: Worker, windowId: number): Promise<void> {
  await worker.evaluate((id) => chrome.windows.remove(id), windowId);
}

/** True when the toolbar icon is pinned, which the demo profile must guarantee (DEMO-4). */
export async function isPinnedToToolbar(worker: Worker): Promise<boolean> {
  return worker.evaluate(async () => (await chrome.action.getUserSettings()).isOnToolbar);
}
