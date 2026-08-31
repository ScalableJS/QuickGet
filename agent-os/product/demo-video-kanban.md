# Demo video — Kanban

Board for the promotional/store recording. Method and conventions (visible cursor, pause
rhythm, caption rules, encoder settings) come from the `demo-video` skill — this board holds
only what is specific to QuickGet Remote.

**Columns:** `Discussion` → `Backlog` → `In Progress` → `In Review` → `Done`.
`Discussion` means the approach is not settled yet — decide before writing code.
Move a card by editing its Status cell and adding a dated line under the card.

---

## Board

| ID | Task | Area | Size | Status |
|----|------|------|------|--------|
| DEMO-1 | Record the 28-second onboarding → intercept → progress promo | video | L | Done |
| DEMO-2 | Deterministic progress fixture in the mock NAS | testing | S | Done |
| DEMO-3 | Build the `Open Downloads` demo source page | video | S | Done |
| DEMO-4 | Demo profile + native window capture harness | video | M | Done |
| DEMO-5 | Open the real action popup from the script | video | S | Done |
| DEMO-6 | Scene markers → `.srt` from real ffmpeg timestamps | video | M | Done |

---

## Cards

### DEMO-1 — Record the 28-second onboarding → intercept → progress promo

**Size:** L · **Area:** video · **Status:** Done (2026-08-31) — `npm run demo:record`
**Blocked by:** DEMO-2, DEMO-4, DEMO-5, DEMO-6
**Precedent:** `store-assets.spec.ts` — an ordinary spec that drives the real mock NAS and
emits artefacts (`npm run capture:store-assets`). The demo belongs in that shape, as a spec
under `tests/e2e/`, not a bespoke harness.
**Unblocked 2026-08-31:** BUG-30 no longer blocks — see "Save as" below.

The scenario the owner asked for: first run → enter NAS credentials → pick folders → open a
real download page → click the torrent → watch the toolbar icon and badge change → see
progress in the popup.

**The framing constraint, verified:** Playwright records the page viewport only. There is no
browser chrome in frame, so the toolbar icon and badge — which are genuine product events
(`markInterceptionStarted()`, `actions.ts:193`; badge counter, `actions.ts:150-160`) — cannot
appear in a Playwright video at all. The popup opened by `launchExtensionPopup()`
(`tests/e2e/support/extension.ts:54`) is also a normal tab, not the real popup under the icon.

**Decision: Playwright directs, a native recorder films.** Playwright drives the scenario and
waits on real state; the master video is a native capture of the whole Chrome window, so the
real toolbar, icon, badge and address bar are all genuinely in frame. Confirmed available:
`ffmpeg` with `avfoundation` `[0] Capture screen 0`. Rejected alternatives: drawing a fake
toolbar (forbidden — it is the one visual that proves the product works, and CWS requires
listing visuals to represent actual behaviour); compositing two independent video sources
(scale/cursor/anti-alias mismatches). Montage crop/zoom out of the single native master is
fine — that is editing, not fabrication.

**Caption plan — reviewed against the `demo-video` skill 2026-08-31. The previous table was
arithmetically impossible and is replaced below.**

The old table read as absolute windows (`0.0–4.0`, `4.0–7.0`, …) summing to exactly 28s, but each
window also had to contain its pause. Subtracting them:

| Beat | Window | Pause | Left for the action |
|---|---|---|---|
| Connect | 4.0s | `study` 3.8 | 0.2s |
| Folders | 3.0s | `study` 3.8 | **−0.8s** |
| Save & test | 2.5s | `glance` 0.9 | 1.6s |
| Open the page | 4.0s | `page` 2.2 | 1.8s |
| Interception | 4.0s | `study` 3.8 | 0.2s |
| Icon + badge | 3.0s | `study` 3.8 | **−0.8s** |
| Progress | 7.5s | `study` 3.8 | 3.7s |

22.1s of the 28 were pauses, leaving 5.9s for typing three fields, picking two folders,
navigating, and a real NAS round-trip. Two beats were negative. Absolute timestamps cannot be
authored up front anyway — real durations vary per run, which is exactly why DEMO-6 derives the
`.srt` from the recorder's own timestamps.

**Rewritten as durations, not timestamps. 6 captions** (the skill asks for 5–8; the old 7 split
"interception" and "icon+badge" into two captions describing one user-level event):

**Captions are in English — owner's call 2026-08-31.** One track only, no Russian. The Chrome Web
Store audience and its reviewer read English, and a single language keeps one master, one `.srt`
and nothing to keep in sync. The skill's default is Russian; this overrides it for this project.

| # | Caption | Pause after | Why this pause |
|---|---|---|---|
| 1 | QuickGet is linked to your QNAP — set up once, then forget it | `normal` 1.6 | Frames the path and states the premise: a configured user |
| 2 | Torrents land in the folders you chose, never on this computer | `glance` 0.9 | Transitional screen; also states what full interception does |
| 3 | Check the connection to the NAS | `page` 2.2 | "Connected to the NAS" is a real round-trip and must be read |
| 4 | Open a page with an ordinary .torrent link | `glance` 0.9 | Passing screen on the way to the payoff |
| 5 | QuickGet intercepts the torrent and sends it to the NAS — the toolbar icon and badge show the active task | `study` 3.8 | The product's core claim, proven by toolbar state |
| 6 | The download is running — progress is visible right inside QuickGet | `study` 3.8 + hold | The payoff; see the closing shot below |

Keep them at user level and in the present tense, exactly as the skill requires in either
language: no "Save & test", no field, endpoint or selector names, and **no wording that promises
more than the run proves** (see the evidence rules below).

Pause budget: 1.6 + 0.9 + 2.2 + 0.9 + 3.8 + 3.8 = **13.2s**, leaving ~13s of real action inside a
~28s target. That is achievable; the old 5.9s was not.

**Corrections against the skill's rules, each one a rule the old plan broke:**

- **Pause goes AFTER the screen changes, never during typing.** The old beat 1 put `study` on a
  frame described as "address/login/password typed" — a pause held while text is being entered
  reads as the demo stalling. Type, let the filled form settle, then pause.
- **No pause between beats where the screen did not change.** Do not "think" in place.
- **The destination gets the longest hold, passing screens get the shortest.** The old plan spent
  `study` (3.8s) on picking folders — a transitional step — while giving the same 3.8s to the
  final progress view. Folders drop to `glance`.
- **Caption 1 must frame the whole journey**, per the skill's "say what comes next" rule.
- Captions stay at user level: no "Save & test", no field or selector names.

**Visible cursor — was missing from the plan entirely.** Playwright does not draw a pointer
(playwright#1374), so without this the video shows fields filling and buttons depressing with
nothing touching them. Copy `templates/mouse-helper.ts` and `templates/captions.ts` from the
`demo-video` skill into `tests/e2e/support/` — copy, do not import from `~/.claude`, they must
commit with the repo.

```ts
await installMouseHelper(page);   // addInitScript, survives future navigations
patchLocatorClick(page);          // every click then glides along a Bézier arc
await page.goto(url);
await ensureMouseHelper(page);    // AFTER every navigation — SPA transitions drop the init script
```

Keep the cursor on in ordinary runs too, so the recording layer stays covered by the normal suite
instead of rotting unnoticed.

Two caveats specific to this demo:
- The overlay is a **DOM overlay inside the page**, so it exists only in the viewport. The
  toolbar-icon beat and the action popup are outside the page — no drawn cursor there. That is
  honest (nothing is faked), but the montage must not imply a pointer moved to the toolbar.
- On a 1080p frame the cursor is sized from `window.innerWidth`; check it is not a dot.

**The URL bar template is NOT needed here** — the skill adds an injected address pill because
Playwright's own recording has no browser chrome. Our master is a native window capture, so the
**real** omnibox is in frame. Injecting a fake pill next to a real address bar would be absurd,
and the skill's own rule ("only the real address") forbids it.

**Pre-roll before the start — was missing.** Open on a settled, still frame before anything moves:
window placed, demo page loaded, first caption already on screen. ~700ms of pre-roll (and the same
at the end) is the *only* sleep the skill permits, and only after the state is confirmed. Start
the recorder, wait for real frames, then mark the scene start — the first frames of a capture are
frequently dropped or half-painted.

**Focus.** The scripted run must not fight the compositor: nothing else may raise a window over
Chrome mid-take. `chrome.action.openPopup()` needs the window focused (the probe calls
`chrome.windows.update(win.id, {focused: true})` first), and an action popup **closes as soon as
it loses focus** — so nothing may steal focus while the closing shot is held. Notifications off,
Do Not Disturb on, no other automation on the machine during a take.

**Closing shot — must show the process running, not a frozen number.** The last beat is the whole
point and needs to *move*: the progress bar advancing, percentage and speed changing across
several polls. Hold it well past the 3.8s `study` — a few seconds of visible motion — so the
viewer sees a live transfer rather than a screenshot.

This is what makes DEMO-2 a hard dependency: after a real `AddTorrent` the mock creates the task
with `progress: 0` and zero speeds (`mockNas.ts:400-412`), so today this shot would be a dead 0%
row. The fixture must return a rising series across successive `Task/Query` calls, and the popup's
own refresh must be what advances it.

Assert the motion, do not just film it — otherwise the closing shot is decoration rather than
evidence:

```ts
const first = await readProgress(page);
await expect.poll(() => readProgress(page)).toBeGreaterThan(first);
```

End on the moving progress; do not close the popup or navigate away on camera.

---

**Step-by-step run — the shooting script.** Every wait is on a fact; the only sleeps are the
pre/post-roll noted above. Facts on the left are what the spec asserts; captions on the right are
what the viewer sees.

| # | Step | Assertion (the fact waited on) | Caption / pause |
|---|---|---|---|
| 0 | Clone the pinned template profile, launch headed, set bounds via CDP, load the demo page, start the recorder, wait for real frames | `getWindowBounds` matches; recorder emits `out_time_us` | — (pre-roll ~700ms, still frame) |
| 1 | Open the popup on first run | Settings form visible, no stored credentials | **1** "Connect QuickGet to your QNAP…" → `normal` |
| 2 | Type address, login, password | Fields hold the typed values | pause *after* the form settles, never during typing |
| 3 | Pick Temp `Download` and Target `Multimedia/Movies` | Both selects hold their value | **2** "Choose the temporary and target folders" → `glance` |
| 4 | Save & test | "Connected to the NAS" rendered — a real round-trip | **3** "Verify the connection to the NAS" → `page` |
| 5 | Navigate to the local `Open Downloads` page (DEMO-3) | The Debian card is visible | **4** "Open a page with an ordinary .torrent link" → `glance` |
| 6 | Click the `.torrent` link (cursor glides in on its arc) | `mockNas.waitForTorrent()` resolves; URL and destination folder match | — (no pause: the screen has not settled yet) |
| 7 | Interception completes | Badge is `1` (`chrome.action.getBadgeText`), title updated, icon in the active state; **no "Save as" ever appears** (`suppressLocalTorrentFile`) | **5** "QuickGet intercepts the torrent…" → `study` |
| 8 | `chrome.action.openPopup()` | The real action popup renders the task | — |
| 9 | Hold on the progress | Progress **strictly increases** across polls; speed non-zero | **6** "The download is running…" → `study` + extra hold on the motion |
| 10 | Stop: `q` to ffmpeg stdin, await exit; write `.srt` from the marks | Container finalised; marks count matches captions | — (post-roll ~700ms) |

Beats 6 and 7 are deliberately one caption over two steps: the click and the badge are a single
user-level event, and the skill caps captions at one per finished user stage.

---

**This is a promo that doubles as proof — what each beat actually proves.** The genre is "promo
with evidence", so every claim on screen must be backed by something the run genuinely produced.
The mapping below is the contract: if a row's evidence disappears, the corresponding caption must
change or go.

| Caption claims | On-screen evidence | Asserted by |
|---|---|---|
| "Connect … a one-time setup" | The settings form starts empty, then holds real typed values | No pre-seeded `chrome.storage`; the form is filled on camera |
| "Verify the connection" | "Connected to the NAS" appears | A real HTTP round-trip to the mock QNAP, not a local flag |
| "an ordinary .torrent link" | The real omnibox shows the page URL; the link is a genuine attachment | `content-disposition: attachment`, so `chrome.downloads.onCreated` fires for real |
| "intercepts … and sends it to the NAS" | No "Save as" appears; the browser download does not complete | `suppressLocalTorrentFile` + `mockNas.waitForTorrent()` resolving with the right URL and folder |
| "the toolbar icon and badge show the active task" | The **real** Chrome toolbar in frame, icon swapped, badge `1` | `chrome.action.getBadgeText()` = `"1"`, native window capture (no drawn chrome) |
| "progress is visible right inside QuickGet" | The **real** action popup, progress advancing | `chrome.action.openPopup()`; progress strictly increasing across polls |

**Where the proof stops — state this honestly and never over-caption it.** The run talks to a mock
QNAP, so what is proven is: the extension intercepts a real `.torrent`, sends a correct request,
and renders the NAS's answer with production code. What is **not** proven is a real file arriving
on real hardware. Therefore:

- Do not caption mock speeds as throughput, and do not say "downloaded in N seconds".
- Do not claim the torrent never touches the disk beyond what `suppressLocalTorrentFile` gives.
- No fabricated toolbar, icon, badge or popup — every one of those is real in this design, which
  is the entire reason for native window capture.

A separate real-NAS run already exists (`popup.real-nas.spec.ts`, `npm run test:e2e:real`). If the
listing ever needs to claim verified end-to-end delivery, that is the run to cite — not this one.

**Before handing the file over** (skill's checklist, and BUG-30's red line): pull 2–3 frames at
1:1 and read them as pictures — cursor present and where the action is; caption on screen for its
whole beat; **no NAS address, hostname, public IP or SID in frame**; the omnibox shows the real
local demo URL; progress visibly moves in the closing seconds.

```bash
ffmpeg -y -ss 12.5 -i demo.mp4 -frames:v 1 -vf crop=1000:620:150:250 crop.png
ffprobe -v error -show_entries format=duration -of csv=p=0 demo.mp4
```

**Compressing onboarding honestly (target 7–9s):** cut the dead time *between* real actions
(jump cuts), never pre-seed via `chrome.storage.local.set()` while the caption claims "first
connection". Typing may be fast; the filled form gets ~0.5–0.8s to be read. `Save & test` is
already a real round-trip that renders "Connected to the NAS", so that beat needs no staging.

**Red lines for the Chrome Web Store listing:**
- Claims about the local file depend on the flag. With `suppressLocalTorrentFile` **off**
  (the default), `download-interception.spec.ts:113-122` accepts `"interrupted" || "complete"` —
  a small file can finish before the cancel, so "never touches the disk" would be false. With it
  **on**, as the demo profile sets it, the file is cancelled at the filename stage. The claim that
  is safe either way: "intercepts .torrent links and sends them to QNAP Download Station".
- No fabricated toolbar, icon, badge or popup.
- No real credentials, public IP, hostname or SID in frame (the password field is
  `type="password"`, `Settings.svelte:468`, so it is safe as-is).
- No claim of partnership with QNAP or Canonical.
- Open-source torrents only — never a private tracker or copyrighted content.
- Mock speeds are task state, not a benchmark: never caption them as throughput.

**"Save as" is solved by an existing flag (verified 2026-08-31).** `suppressLocalTorrentFile`
(`config.ts:31`, default `false`) cancels at the `onDeterminingFilename` stage before Chrome can
prompt or commit a file (`downloads.ts:233`). It has a settings checkbox
(`Settings.svelte:510`), unit coverage (`downloads.test.ts:88-117`) and e2e coverage
(`download-interception.spec.ts:328`). The demo profile must set it **explicitly** — the default
is off. Bonus: the checkbox is on camera during the onboarding beat, so the demo shows a real
product option rather than hiding one.

Note it is *not* transactional: a failed hand-off means the user re-clicks. Fine for a recording,
but it is the reason the pitch must not over-promise beyond "intercepts and sends".

The demo profile turns the flag **on**, which is the whole point of the setting: full interception,
no local `.torrent`, no "Save as". Coverage note only: the strict-mode e2e
(`download-interception.spec.ts:320`) is `test.skip` because Playwright cannot observe a native
save dialog — the behaviour itself is covered by `downloads.test.ts:88-117`.

**Decision 2026-08-31 — the demo is fully scripted, and it *is* an e2e test.** One run produces
both a pass/fail result and the master video. No hand-performed step in the take; the toolbar-icon
click is replaced by `chrome.action.openPopup()` (DEMO-5), verified working here.

**The test must stay a test.** The risk of a demo-shaped spec is that it degenerates into a script
that waits and films. Guard: every beat waits on a *fact*, and the causal chain is asserted end to
end — real DOM click → interception → real HTTP request to the mock QNAP → mock response → real
extension state → real `chrome.action` badge/title → real action popup. If the product breaks, the
run goes red **and** yields no usable master. Scene markers only record timing; they never assert.

**Honesty limit of the DEMO-2 fixture.** A scripted rising progress series is a scripted *backend*,
not a scripted UI — the popup renders it with production code over the same API. So the spec may
assert that the popup *displays* NAS state correctly; it must not claim a real download is
progressing, and the captions must not present mock speeds as throughput.

---

### DEMO-2 — Deterministic progress fixture in the mock NAS

**Size:** S · **Area:** testing · **Status:** Done (2026-08-31)
**Files:** `tests/e2e/support/mockNas.ts`

Implemented as an opt-in `progressFixture` option on `startMockNas()`. Every `Task/Query` advances
each still-downloading task one step, so successive polls return a rising series instead of the
frozen 0% row a real `AddTorrent` leaves behind.

It keeps the row **coherent**, which a naive percentage bump would not: byte counters track the
percentage, ETA falls as the remainder shrinks, and a task reaching 100% flips to seeding with the
download rate dropped to zero — the same shape a real task has.

```ts
const nas = await startMockNas({ progressFixture: { stepPercent: 12 } });
```

**Verified 2026-08-31** with `stepPercent: 25`:

```
poll 1:  25%  state=104  4.2MB/s  0.20GB  eta=141s
poll 2:  50%  state=104  4.2MB/s  0.40GB  eta=94s
poll 3:  75%  state=104  4.2MB/s  0.59GB  eta=47s
poll 4: 100%  state=100  0.0MB/s  0.79GB  eta=0s      <- seeding, rate cleared
```

**A bug caught while writing it:** the first draft keyed off `state === 2`, guessing at the QNAP
codes. `mapUnifiedStatusToQnapState` says downloading is **104** and seeding **100**, while 2 is
*stopped* — the fixture would have advanced stopped tasks and ignored running ones. The codes are
now named constants referencing that mapper.

Defaults match the demo's Debian card (791,674,880 bytes ≈ the real ISO, 4.2 MB/s). Off unless
requested, so ordinary runs are untouched: the full mock suite passes (20 passed, 1 skipped).

**Honesty limit, restated because it is easy to lose:** this scripts the *backend*. The popup still
renders it with production code over the same API, so a spec may assert that the UI displays NAS
state correctly — never that a real transfer is happening.

---

### DEMO-3 — Build the `Open Downloads` demo source page

**Size:** S · **Area:** video · **Status:** Done (2026-08-31)
**Files:** `tests/e2e/fixtures/demo-page/`, `tests/e2e/support/demoPageHost.ts`

**Built on Simple.css, vendored — no wheel reinvented.** Surveyed the classless-CSS family
(styles semantic HTML with no classes, one file, no build step), which is exactly this job:

| | Size | License | Auto dark |
|---|---|---|---|
| **Simple.css** ✅ | 9.4 KB | MIT | yes |
| water.css | 22.7 KB | MIT | yes |
| Pico | 71 KB | MIT | yes |
| sakura | 4.1 KB | MIT | no |

Simple.css wins on reading-tuned typography at a small size. **Vendored into the fixture, not
linked from a CDN** — the run must be deterministic and work offline. MIT, so committing it is
fine; keep the file byte-for-byte as fetched.

**Two things the rendered page revealed that the markup did not:**

- Simple.css lays `body` out as a **two-column grid** on wide viewports, which parked the title
  in a tinted sidebar and pinned everything left — half of a 1920px frame empty. Collapsed to a
  single centred column (`display: block !important`; the framework sets the columns inside a
  min-width media query, so plain overrides lose).
- The recording machine runs macOS **dark**, and Simple.css follows `prefers-color-scheme`. The
  palette is now pinned to light in the page's own `<style>`, so the frame looks identical
  wherever it is shot. Verified by rendering with `colorScheme: "dark"` — background stayed white.

**Verified on a 1920×1080 render:** 0 images, 0 scripts, 0 external requests; root font 19px;
card 883px wide and centred; the click target is `#download-torrent`, 245×65 px, a plain `<a>`.

**The torrent is real.** `debian-13.6.0-amd64-netinst.iso.torrent` (60,868 bytes) fetched from
the official `cdimage.debian.org` mirror. Parsed to confirm it is what the card claims:
`name = debian-13.6.0-amd64-netinst.iso`, `comment = Debian CD from cdimage.debian.org`,
length 791,674,880 bytes. The card's version text matches the file — keep them in step if it is
ever refreshed.

**`startTorrentHost()` could not serve this** — it answers *every* path with one attachment, so a
page the demo must navigate to first is impossible. Added `startDemoPageHost()` instead: page and
stylesheet render normally, the `.torrent` goes out as `content-disposition: attachment`, and it
keeps the same headers-first/body-after-a-beat trick so a 60 KB localhost file cannot complete
before the extension acts.

**Verified end to end (2026-08-31), not just by reading the code:** Chromium at 1920×1080 with the
OS in dark mode → page title `Open Downloads`, body background white (the light pin holds),
clicking `#download-torrent` fires a genuine Chrome `download` event with
`suggestedFilename = debian-13.6.0-amd64-netinst.iso.torrent`, and the host counts exactly one
torrent fetch. That download event is precisely what makes `chrome.downloads.onCreated` fire, so
the interception the demo films is real. `tsc --noEmit` clean.

**Decided 2026-08-31.** Neither a real third-party site nor a look-alike: an **own, honestly
neutral catalogue page** served by `startTorrentHost()`, linking a genuine official `.torrent`.
Reproducible, and the torrent is real — `content-disposition: attachment` fires
`chrome.downloads.onCreated` for real.

Rejected: filming ubuntu.com. Not forbidden in itself, but the CWS impersonation policy bars
implying endorsement, and Ubuntu plus its logo are Canonical trademarks. The asymmetry that
settles it: an incidentally visible third-party site is low risk, while **copying someone's logo
onto our own page is a trademark risk we have no reason to take**. Practically it also drags in
cookie banners, redesigns, geolocation and CDN latency.

**Page spec — reads as a small real catalogue, not a stub and not a clone:**

- Title `Open Downloads`, subtitle "Freely distributable downloads for testing BitTorrent clients."
- Cards, `max-width` 900–1000px, real typography, **our own favicon**, generic download icons.
- Project names **as text only — no Ubuntu/Debian/Blender logos.**
- Footer, small: "Project names and trademarks belong to their respective owners. No affiliation
  or endorsement is implied."
- Forbidden names: `Ubuntu Downloads`, `Official Linux Torrents`, `Ubuntu Mirror`, or anything
  resembling ubuntu.com / debian.org.

**Content — one Debian card for the 28-second take.** One card keeps the narrative clean for a
CWS reviewer: legal Linux download → NAS.

| Source | License to print | Note |
|---|---|---|
| Debian official installer | `Free/Open Source · multiple licenses` | **Not** "GPL" — the ISO is an aggregate of GPL/LGPL/BSD/MIT under DFSG |
| Tears of Steel / Big Buck Bunny / Sintel | `CC BY 3.0` | Blender open movies, safe spares |
| Internet Archive | per-item only | **Not safe wholesale** — IA licenses each item separately and does not warrant copyright status. Only a specific verified CC0/CC-BY item |

Never a private tracker or copyrighted content: CWS bars extensions facilitating unauthorised
downloads of copyrighted media, and the promo is evidence of intended use.

**Open sub-question:** link the live debian.org `.torrent` (zero redistribution questions, but a
network dependency mid-take) or vendor the verified `.torrent` next to the page (fully offline).
Recommendation: vendor it for the repeatable run, since DEMO-3 exists for reproducibility.

---

### DEMO-4 — Demo profile + native window capture harness

**Size:** M · **Area:** video · **Status:** Done (2026-08-31)
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

---

### DEMO-5 — Open the real action popup from the script

**Size:** S · **Area:** video · **Status:** Done (2026-08-31)
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

---

### DEMO-6 — Scene markers → `.srt` from real ffmpeg timestamps

**Size:** M · **Area:** video · **Status:** Done (2026-08-31)
**Files:** `tests/e2e/support/sceneRecorder.ts`

`SceneRecorder` runs the ffmpeg capture and timestamps captions against **the recording's own
clock**: `-progress pipe:1 -stats_period 0.1`, parsing `out_time_us`. `mark(caption)` is called
immediately after an assertion passes, so every caption is anchored to a confirmed product fact
rather than to an intended moment. `start()` waits for actual frames before returning, `stop()`
writes `q` to stdin and awaits exit so the container finalises, and `READ` carries the skill's
pause constants.

**Three defects found by driving a real ffmpeg process rather than reading the code:**

1. **The screen device is `[0]`, not `[1]`.** `ffmpeg -f avfoundation -list_devices true` reports
   `[0] Capture screen 0` here. The first draft defaulted to `1:none`, which would have failed at
   the worst possible moment. Default is now `0:none`, with a note to re-check on another machine.

2. **The recorder trusted `out_time_us` blindly.** Driven from a synthetic `lavfi` source it
   reported 127s of media time after ~3.5s of wall-clock. A real screen capture is real-time so
   this would not normally bite, but a badly dropping capture drifts the same way and every caption
   would then sit on the wrong frame. Added `drift` and `assertRealTime()`; verified it catches a
   runaway source (drift 206s → throws) and passes a paced one (drift −0.01s).

3. **The `.srt` had overlapping cues.** A 1.2s minimum duration overran the next caption's start
   (end `00:00:01,933` vs start `00:00:02,000`), and players render overlapping cues unpredictably.
   A caption now always ends where the next begins; only the final one may be stretched. Verified
   monotonic and non-overlapping:

```
cues: 0.767->1.933  1.933->2.867  2.867->5.733
no overlaps, monotonic: true
```

**Two-pass pipeline, revised 2026-08-31 after checking the encoder question rather than assuming.**
Capture is hardware (`h264_videotoolbox -realtime 1 -b:v 35M`), and `finishMaster()` does the slow
`libx264 -preset slow -crf 17` pass afterwards. The reason is not speed for its own sake: ffmpeg's
avfoundation input defaults to `drop_late_frames=1`, so an encoder that cannot keep up drops
frames — and a dropped frame shifts the very media clock the captions are timed against. Capture
fast, finish for quality off the clock. `-drop_late_frames 0` is set as well.

`-tune stillimage` was dropped from the capture: this is browser motion and scrolling, not a
slideshow.

**Burning subtitles in is not available here.** The local ffmpeg is built **without libass**, so
the `subtitles` filter does not exist — it fails with "Error parsing a filter description" no
matter how the path is escaped (an escaping bug I chased first, wrongly). `finishMaster()` muxes a
**soft `mov_text` track** instead, which is selectable in a player and still editable. Burn-in
would need an ffmpeg built with `--enable-libass`.

**Verified end to end on a 3440×1440 synthetic source** (real capture is blocked on the permission
above):

```
CAPTURE: h264 1920x1080  duration=5.2      <- cropped from 3440x1440
MASTER : h264 1920x1080 + mov_text track   <- soft subtitles muxed
drift  : -0.12s
```

---

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
the wrong one — "настроил → клацнул → скачал" was the requested story, and starting from a
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
