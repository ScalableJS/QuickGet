---
type: "task"
id: "DEMO-4"
status: "done"
priority: "p2"
area: "video"
board: "demo-video"
updated: "2026-10-09"
legacy_status: "Done"
size: "M"
---

# Demo profile + native window capture harness

**Size:** M · **Area:** video
**Files:** `tests/e2e/support/extension.ts` (already accepts a persistent `userDataDir`)

Groundwork so the recording is repeatable rather than a one-off screen grab:

1. **Done — `tests/e2e/support/demoProfile.ts`.** The hand-pinned template profile turned out to
   be unnecessary: **seeding `extensions.pinned_extensions` in the profile's `Preferences` before
   first launch pins the icon.** Verified 2026-08-31 — a profile never opened by hand reports
   `isOnToolbar: true`, while an unseeded control reports `false`. `createDemoProfile()` builds a
   throwaway profile per run, so there is no fixture to mutate and no manual step at all.
   (`chrome.action` still cannot pin — the getter finding under DEMO-5 stands; the profile file is
   a different route to the same state.) The profile must also set `suppressLocalTorrentFile`,
   which is off by default.

   **Window geometry: `placeDemoWindow()` via CDP, and launch the context with `viewport: null`.**
   Launch flags alone are not enough — Playwright's viewport overrides `--window-size`, and a
   request for 1920×1080 came back as **1282×846**. With `viewport: null` plus
   `Browser.setWindowBounds`, 1920×1080 is granted exactly (viewport 1920×993, chrome 87px). The
   window lands at `top: 30` because of the macOS menu bar, so **the capture crop must use the
   returned bounds, not 0,0** — the helper returns them for that reason.
2. Launch headed with that profile (the helper already supports `userDataDir` and `headless`).
3. Start native capture of the browser **window**. **Owner's call 2026-08-31: the master is
   1920×1080, 16:9.** No 4K, never an ultra-wide master. The display here is 3440×1440 (21:9), so
   capturing the whole screen would bake in the wrong aspect: crop to the window, do not film the
   desktop.

   The **window** is 1920×1080, not the viewport — Chrome's toolbar and omnibox eat height, so you
   cannot have both a 1920×1080 viewport and the chrome in frame. That is fine: the toolbar is the
   point of this demo. The viewport is whatever is left, roughly 1920×(1080 − chrome height).

   **This display is NOT Retina — verified 2026-08-31:** `system_profiler` reports Resolution
   3440×1440 and "UI Looks like: 3440×1440", i.e. `backingScaleFactor = 1`. Two consequences that
   contradict the usual advice:

   - A 1920×1080 window captures as exactly 1920×1080 physical pixels. Capture is **1:1 and the
     master needs no downscale at all** — do not add a `scale` filter, and never upscale.
   - There is **no Retina supersampling to hide encoder artefacts**, so text quality rests entirely
     on the encoder. `-crf 17 -tune stillimage` is therefore mandatory, not a nicety.

   The window fits with room to spare (1920 ≤ 3440 wide, 1080 ≤ 1440 tall, 360px of vertical slack
   for the menu bar and Dock). Re-derive the scale factor if the demo is ever shot on a real Retina
   machine — do not carry these numbers over.

   **Prefer window capture over display capture.** ffmpeg's `avfoundation` grabs a whole *display*,
   which then forces us to handle the crop, the menu bar, the Dock, anything overlapping Chrome,
   and the Retina point-vs-pixel conversion. macOS **ScreenCaptureKit** can capture a specific
   window (`SCContentFilter(desktopIndependentWindow:)`), which removes all of that. Cost: a small
   Swift helper in `tools/` — write our own ~100 lines rather than depend on a low-popularity CLI.
   Do not hardcode `physical = logical * 2`: derive the factor from the two measured geometries,
   since scaled display modes make the assumption wrong.

   **Decision 2026-08-31: crop, not ScreenCaptureKit.** avfoundation has no native region capture
   — `grab_x`/`grab_y` exist only on x11grab, and ffmpeg's wrapper builds `AVCaptureScreenInput`
   over the whole display without exposing a `cropRect`. So the pipeline is: capture the display,
   `-vf "crop=1920:1080:0:30"`, encode. The crop runs before the encoder, so the encoder never
   sees 3440×1440, and the filter itself is negligible next to capture and encode. All four crop
   numbers are even, which 4:2:0 chroma subsampling wants — keep them that way.

   **Coordinates line up only because this display is scaleFactor 1**: CDP's logical points equal
   avfoundation's physical pixels here. That breaks if display scaling changes, a second monitor
   appears, the primary display moves, or the menu bar auto-hides. So the crop must be built from
   the bounds `placeDemoWindow()` *returns*, and the demo spec should assert them as a hard
   prerequisite rather than trusting the request.

**Two blockers found by trying it, both must be resolved before a take:**

1. **Screen capture works — corrected 2026-08-31.** An earlier attempt hung and I wrongly
   concluded the permission was missing. It is granted (to **Visual Studio Code**, which is the
   parent process here — the harness does not run under iTerm). A 3-second capture produced 90
   frames at 1920×1080, `speed=0.978x`, cropped correctly from `0,30` with the menu bar excluded.

   What actually blocks a run is a **macOS consent dialog**: "Visual Studio Code is requesting to
   bypass the system private window picker and directly access your screen and audio", with
   Allow / Open System Settings. The first capture was waiting on it, not failing. It appears in
   frame, so dismiss it **before** a take and confirm a throwaway capture runs clean.

   **Desktop hygiene is now a real constraint.** The probe frame caught an open Gmail inbox with
   personal mail, several project windows and the Settings app. The capture is cropped to the
   Chrome window, so anything overlapping that rectangle lands in the promo. Before a take: close
   or move every other window off the capture rectangle, quit anything that can raise a window,
   and check the first extracted frame for personal content before sharing the file.

2. **Playwright does not move the OS cursor — so `-capture_cursor 1` is wrong here.** Measured
   with a Swift `CGEvent(source: nil).location` probe: the pointer sat at `1049,511` before
   `mouse.move()`, after two moves, and after a `click()` — unchanged. A native capture would
   therefore record a *stationary* arrow parked wherever the user left it, which is worse than no
   cursor at all and would misrepresent where the action is.

   **Playwright ships this natively as of v1.61 — and we are already on 1.61.0.** The
   `page.screencast` API records the page with `showActions({ cursor: "pointer" })`, which draws a
   pointer that animates from the previous action point to the next, highlights the element and
   labels the action. No third-party package, no `mouse-helper` template to vendor, no OS-cursor
   automation.

   **Verified against our own demo page**: a frame mid-click shows the drawn cursor sitting on
   `Download .torrent`, the button in its hover state, and a "Click" label in the corner. It also
   works in a **headed persistent context with `viewport: null`** — the exact configuration the
   demo profile uses. There are `showChapter()` and `showOverlay()` too, which cover captions
   inside the frame (overlays are `pointer-events: none`, so they never block a click).

   **The catch stands: `screencast` records the page, not the browser window.** So the cursor is
   real in every in-page beat, but the toolbar-icon and action-popup shots still come only from
   the native capture, which has no drawn cursor and no moving OS pointer.

**The third route: drive the real macOS pointer.** Confirmed independently — CDP cannot do this
   by design (`Input.dispatchMouseEvent` is browser input injection, never CoreGraphics/HID), which
   matches the measurement. `cliclick` 5.1 is the practical tool: BSD-licensed, **bottled for Apple
   Silicon so no native build**, `-e 5` gives eased human-like movement. It needs Accessibility
   permission and is not installed yet. Alternatives rejected: nut.js puts prebuilt binaries behind
   a paid tier, robotjs forks are stale, AppleScript ends up calling cliclick anyway.

   Screen coordinates come from the element, never hardcoded:

   ```ts
   const box = await locator.boundingBox();
   const point = {
     x: bounds.left + box.x + box.width / 2,
     y: bounds.top + chromeHeight + box.y + box.height / 2,
   };
   ```

   `chromeHeight` is `bounds.height - viewportHeight` measured at runtime (87px here) — do not
   hardcode it, it changes with the bookmarks bar and Chrome versions.

   **Do not mix a drawn cursor with the real one**: with `-capture_cursor 1` the system pointer is
   recorded too, so a DOM overlay on top means *two* cursors on screen. Either park the physical
   pointer outside the crop and draw one, or drive the physical one and draw none.

   **Three coherent shapes for DEMO-1 — an owner decision:**

   | | Cursor | Toolbar + real popup | Cost |
   |---|---|---|---|
   | **Screencast only** | drawn, animated, free | **absent** — the product's proof is missing | none |
   | **Native + cliclick** | real system pointer everywhere | in frame | install cliclick, grant Accessibility, coordinate maths |
   | **Both, cut together** | drawn in page beats, none in chrome beats | in frame | an edit, and the cursor visibly changes character mid-video |

   **Decided and implemented 2026-08-31: native capture + real system pointer**
   (`tests/e2e/support/systemCursor.ts`). The toolbar icon and the real popup are the reason this
   is filmed natively at all, and one genuine pointer throughout is simpler and more honest than a
   cursor that changes character halfway.

   `cliclick` 5.1 installed from a bottle — no build. **Accessibility needed no new grant**: it is
   inherited from the parent app (VS Code), already permitted. Verified by moving the pointer and
   reading it back.

   `SystemCursor.measure(page, bounds)` derives Chrome's UI height at runtime
   (`bounds.height - innerHeight`) rather than hardcoding the observed 87px, then maps any locator
   to a screen point.

   **Verified end to end, not just arithmetically:**

   ```
   window       : {"width":1920,"height":1080,"left":0,"top":30}
   target point : {"x":679.8,"y":621.9}
   cursor now   : {"x":680,"y":622}          <- landed within a pixel
   :hover        : true                       <- the PAGE confirms the real pointer is on it
   real click   : download started, debian-13.6.0-amd64-netinst.iso.torrent
   ```

   The `:hover` check is the one that matters: it proves the physical pointer is genuinely over the
   element, not merely at coordinates that look right. And the click travels the real user path —
   CoreGraphics → WindowServer → Chrome — rather than being injected into the renderer.

   `park()` moves the pointer outside the capture rectangle for beats where nothing should be
   pointed at. Playwright's `screencast` cursor stays unused in this shape: mixing a drawn cursor
   with `-capture_cursor 1` would put two pointers in frame.
4. Playwright waits on **facts**, never `sleep`: "Connected to the NAS", the `AddTorrent`
   request, `chrome.action.getBadgeText()`, the task appearing.
5. Encode per the skill: `-preset slow -crf 17 -tune stillimage`, `yuv420p`, `+faststart`.
   With no Retina supersampling (see step 3) this is the only thing protecting glyph edges —
   `crf 24` would turn the popup's small text to mush. No `scale` filter: the capture is already
   1920×1080.
6. Check the result on 1:1 crops, not a shrunken frame.
7. The `Open Downloads` page (DEMO-3) is laid out for this frame: a 900–1000px card column inside
   a ~1920px-wide viewport leaves generous margins and needs no zoom. Since there is no Retina
   supersampling, set the page's base font a little larger than a normal site would use — the text
   has to stay readable in a video player, not on a desk monitor.

Captions: the skill's overlay assumes a Playwright-rendered page. With a native master the
`.srt` is authored against the final timeline and burned/muxed at the ffmpeg stage instead —
decide which as part of DEMO-1.

`ffmpeg` is present (`avfoundation`, `[0] Capture screen 0`); `cliclick` is not yet installed.
The whole run must be one script: launch profile → Playwright drives → cliclick clicks → ffmpeg
captures. Nothing performed by hand (decision under DEMO-1, 2026-08-31).
