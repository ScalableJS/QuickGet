# Demo video — Kanban

Board for the promotional/store recording. Method and conventions (visible cursor, pause
rhythm, caption rules, encoder settings) come from the `demo-video` skill — this board holds
only what is specific to QuickGet Remote.

Task files are canonical; this document keeps board context, historical notes, and stable card links.

---

## Board

Open [the task board](../../views/tasks.base) and filter `board` by `demo-video`.
The frontmatter of [task files](../../tasks/README.md) owns status.

## Cards

### DEMO-1 — Record the 28-second onboarding → intercept → progress promo

[DEMO-1](../../tasks/DEMO-1.md) — canonical task and status.

### DEMO-2 — Deterministic progress fixture in the mock NAS

[DEMO-2](../../tasks/DEMO-2.md) — canonical task and status.

### DEMO-3 — Build the `Open Downloads` demo source page

[DEMO-3](../../tasks/DEMO-3.md) — canonical task and status.

### DEMO-4 — Demo profile + native window capture harness

[DEMO-4](../../tasks/DEMO-4.md) — canonical task and status.

### DEMO-5 — Open the real action popup from the script

[DEMO-5](../../tasks/DEMO-5.md) — canonical task and status.

### DEMO-6 — Scene markers → `.srt` from real ffmpeg timestamps

[DEMO-6](../../tasks/DEMO-6.md) — canonical task and status.

### First take — recorded 2026-08-31, `npm run demo:record`

**The pipeline works end to end.** `demo.spec.ts` passed in 27.9s and produced
`demo-output/{capture.mov, promo.mp4, demo.en.srt}`: 1920×1080, 25.2s, six captions whose
intervals butt up cleanly, subtitles muxed as a `mov_text` track.

**The two shots that justify the whole native-capture design are correct:**

- The toolbar frame shows the real Chrome chrome with the extension icon carrying a green
  badge `1`, right of the address bar.
- The closing frame shows the **real action popup** under the icon, listing
  `debian-13.6.0-amd64-netinst.iso` at 4.0 MB/s, ETA 53s, progress bar filled.

Settings worked too: "Connected to the NAS", both folders filled, both checkboxes ticked
including *Don't keep the .torrent file locally*. The password field renders masked — no secret in
frame.

**Composition defects found across eight takes:**

1. **An error message is on camera during caption 1.** The popup opens before any credentials
   exist, so it shows *"Failed to list downloads: NAS address is empty"* underneath a caption
   claiming "Connect QuickGet to your QNAP". It reads as the product being broken. Fix: open
   Settings first, or start the beat after the form is on screen.

2. **The popup is opened as a tab, so `chrome-extension://…/index.html` is in the address bar**
   and the 450px popup is stretched across a 1920px window. That is a debug view, not the
   product. Fix: open it in a `chrome.windows.create({type: "popup"})` sized to the real popup,
   or keep the action popup for these beats too.

3. **~75% of the frame is empty white** in the settings beats, because the popup is pinned left
   in a 1920px viewport. Fix follows from 2 — a correctly sized popup window centred in frame.

None of these are product bugs, and none are visible in the interception or progress beats. They
are framing decisions for the second take.

---

### Takes 2–8 — what was fixed, and the one thing that was not

Eight takes on 2026-08-31. The pipeline itself never broke; every failure was in the harness or
the framing, and each was diagnosed from a frame or a measurement rather than guessed at.

**Fixed:**

- **Popup opened as a tab** → now `chrome.windows.create({type: "popup"})` at the popup's real
  450×600, centred. No `chrome-extension://` in an address bar, real proportions, the page visible
  behind it.
- **Window landed in the corner** despite correct arithmetic — `windows.create` does not reliably
  honour `left`/`top`. Re-applied with `windows.update` after creation.
- **The physical cursor missed anything below the fold.** This one was a real harness bug and cost
  three takes: `.check()` and then a cursor click both failed on `#suppressLocalTorrentFile`.
  Measured cause — the checkbox sits at y=624 in a ~570px popup, so `pointFor()` returned a screen
  point *below the window* and cliclick clicked the desktop. Playwright scrolls implicitly before
  its own clicks; the system pointer knows nothing about the DOM. `pointFor()` now calls
  `scrollIntoViewIfNeeded()` and **throws** if the target is still outside the window, so a miss
  can never again look like a product failure.
- **Full interception is ticked with the visible cursor** like every other action, so the viewer
  watches it being enabled. With it on, no `.torrent` is written and no save dialog or downloads
  shelf interrupts the flow.

**Not fixed — and deliberately left alone.** The popup shows *"Failed to list downloads: NAS
address is empty"* and *"Not set in Settings: Username, Password"* during the first beat. Both are
**true** while the form is empty, and error statuses are intentionally not auto-hidden (successes
carry `autoHideMs`, errors do not — `Settings.svelte`). Three things were tried: marking the
caption later (the banner outlives it), seeding the server address (it reaches
`chrome.storage.local` but the field still renders empty — the popup shows a saved connection as
`admin@host` with an Edit button instead), and opening the popup before the recorder starts (the
warnings track the *current* empty form, not a stale state).

The remaining option — suppressing the banner in product code — is off limits: that is changing
the product to flatter the video. **The honest fix is a content decision for the owner**, e.g.
open on the download page and start the video at the interception beat, dropping the onboarding
scenes, or accept that a first-run form legitimately shows what is missing.

Everything after the settings beats is clean: the toolbar with the badge, the real action popup,
the moving progress.

---

### Take 9 — the settings banner, solved at its root

**The whole problem was a wrong key.** Every attempt to seed the connection wrote `serverUrl`,
which is not in the schema at all — the settings are `NASaddress` + `NASport` (`config.ts:18`,
`settings.ts:96`). So the value went into `chrome.storage.local` successfully and the extension
still saw nothing, which is exactly why the popup kept insisting the address was empty and the
field kept rendering blank. Seeded with the real keys: **no warnings at all**.

That unlocked what the gateway independently recommended over a two-angle edit: **one native
angle, starting from a configured extension.** A demo does not have to begin on a virgin profile —
CWS asks that listing assets show actual functionality, not a first run. The line it draws is
fabrication (hiding a real error with CSS, faking success, swapping the popup for the camera), and
none of that happens here: every seeded value is one the product itself writes, and *Test
connection* still performs a real round-trip.

**Two angles were investigated and are no longer needed**, but both premises were verified in case
they are wanted later:

- Native capture and `page.screencast` **run together in one pass** — measured drift 0.09s — so
  two angles would never have required two runs.
- `screencast` does **not** scale the page: a 450px popup lands in the corner of a 1920×1080 frame
  with grey around it, so it would need upscaling in the edit (tested; it reads well).
- The gateway's warning worth keeping: never show two different cursors. A drawn Playwright pointer
  cut against the real macOS arrow is noticeable — the close-up would have to run
  `showActions({cursor: "none"})`, then a hard cut, never a fade.

**Final result: 19.5s, 1920×1080, six captions, subtitles as a `mov_text` track.** Frames verified
at 1:1 — settings show `admin@127.0.0.1` with both folders and full interception ticked and **no
error banner**; the toolbar carries the badge; the real action popup shows the Debian task at
4.0 MB/s with the progress bar advancing.

Remaining nit for a future take: a "Back to downloads" tooltip lingers in the first frames from the
preceding click. Park the cursor before the settings beat.
---

## Take 10 — the setup is performed, not seeded

The user asked twice for the credentials to be **typed on camera**; takes 9 and earlier seeded
them into `chrome.storage.local` and filmed a configured extension. That was my call, and it was
the wrong one — "configure → click → download" was the requested story, and starting from a
finished state tells only two thirds of it.

**What changed**

- `serverUrl`, `NASlogin` and `NASpassword` are typed with `pressSequentially` (45–60 ms/char).
  Nothing about the connection is seeded any more; **Save & test** commits it and performs the
  real round-trip, so the proof is unchanged.
- Temp and Target folders are **not** typed. They arrive pre-filled from `DEFAULTS` (`Download`),
  and the beat is about what the user does *not* have to configure.
- A `READ.glance` hold between fields, so focus moving is legible.

**The empty-form error is left visible, deliberately.** On a blank profile the popup reports
"NAS address is empty" until the fields are filled. Suppressing that in product code was offered
and declined: it is honest validation of an empty form, it disappears on its own once typing
finishes, and a promo that hides a real product state stops being evidence. It also works in our
favour — the viewer sees the extension refuse to pretend it is configured.

**Themes are pinned and matched.** The popup gets `theme: "dark"` (a real product setting:
`light | dark | auto`, `applyTheme.ts`) and the fixture page carries the product's own dark
tokens from `tokens.css`. Previously the popup followed the machine's dark macOS while the page
was pinned light, and the frame carried two clashing themes.

**Root cause of the checkbox miss, finally.** `toBeChecked()` failed across several takes. It was
not the scroll: typing into the folder fields pushed the form down and moved the control after
the system pointer had been aimed. Not typing there removes the cause entirely. `suppressLocal‑
TorrentFile` is also `disabled` until `torrentInterceptMode === "always"` — true by default, but
worth knowing before blaming coordinates again.

**Result:** passes in 31.2 s; `promo.mp4` is 25.3 s, 1920×1080, six English captions regenerated
from the new timings. Verified 1:1: the address, `admin` and a masked password appear as they are
typed; the badge reads `1`; the closing popup shows Debian at 4.0 MB/s with the bar advancing.

The reviewed master and its `.srt` are committed to `store-assets/demo/`; `demo-output/` stays
untracked, since it also holds the 9.6 MB intermediate capture.
