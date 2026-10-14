---
type: "task"
id: "DEMO-5"
status: "done"
priority: "p2"
area: "video"
board: "demo-video"
updated: "2026-10-09"
legacy_status: "Done"
size: "S"
---

# Open the real action popup from the script

**Size:** S · **Area:** video
**Files:** `tests/e2e/support/actionPopup.ts`
**Blocks:** DEMO-1

Playwright cannot click the toolbar icon — it drives page content only. But it does not need to:
**`chrome.action.openPopup()` opens the genuine action popup**, not `popup.html` in a tab.

**Probed on this machine 2026-08-31 against the real `dist/` build — not taken from docs:**

```
worker:             hdeipkdkjejfhbdmcejlgdccpocfbbcm   (matches the Web Store ID)
openPopup exists:   function
openPopup call:     opened
getUserSettings:    {"isOnToolbar": false}
Browser.getWindowBounds: {left:40, top:40, width:1282, height:846}
```

Local Chrome 151, Playwright's bundled Chromium 149; `openPopup()` needs 127+, so both are far
past it. `minimum_chrome_version` in the manifest is 120 — that is the *product's* floor and does
not need raising, since `openPopup()` is used only by the demo harness, never by the extension.

```ts
await worker.evaluate(async () => {
  const win = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  await chrome.windows.update(win.id, { focused: true });
  await chrome.action.openPopup({ windowId: win.id });
});
```

**This supersedes the cliclick plan.** No `brew install cliclick`, no screen coordinates, no
Retina point-vs-pixel conversion for the click, and nothing that can miss its target. Chrome
performs the real action operation itself, which is also a *stronger* e2e assertion than a blind
coordinate click would be.

**What still needs a prepared profile.** `isOnToolbar: false` above confirms pinning cannot be set
programmatically — Chrome treats it as a user setting, and `chrome.action` exposes only the
getter. So DEMO-4 keeps a **template profile with the icon pinned by hand once**, cloned per run
(`fixtures/chrome-demo-profile/` → `test-results/demo-profile-<uuid>/`) so the fixture is never
mutated. That single manual step is profile *setup*, not part of the take; the recording itself
stays fully scripted.

Whether the managed-preferences `ExtensionSettings` / `toolbar_pin: force_pinned` policy can
replace even that hand-pinning is worth one experiment — it is the cleaner answer if it applies to
a Playwright-launched Chromium with a custom `userDataDir`.

**Shipped as `tests/e2e/support/actionPopup.ts`** — `openActionPopup()`, `waitForActionPopupTarget()`
and `isPinnedToToolbar()`.

**The popup is invisible to Playwright — found while building this, and it changes how the demo
spec must assert.** After `openPopup()` the context still lists only its ordinary tabs, and
`chrome.extension.getViews()` is unavailable from an MV3 service worker. The popup *is* real: a
CDP `page` target on the extension origin appears only after the call.

```
BEFORE: [ service_worker:service-worker-loader.js ]
AFTER : [ service_worker:service-worker-loader.js, page:index.html ]
       → chrome-extension://hdeipkdkjejfhbdmcejlgdccpocfbbcm/src/popup/index.html
```

So the helper waits on the **CDP target**, not on a `Page`, and a negative control confirms it does
not fire before the popup is opened.

**Consequence for DEMO-1:** the popup's contents cannot be asserted with Playwright locators.
Assert the underlying state instead — the task via the mock NAS, the badge via `chrome.action` —
and let the video show the rendering. The closing shot's "progress strictly increases" assertion
must therefore read the NAS/mock state, not scrape the popup's DOM.
