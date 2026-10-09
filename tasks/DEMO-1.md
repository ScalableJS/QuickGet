---
type: "task"
id: "DEMO-1"
status: "done"
priority: "p2"
area: "video"
board: "demo-video"
updated: "2026-10-09"
legacy_status: "Done"
size: "L"
---

# Record the 28-second onboarding → intercept → progress promo

**Size:** L · **Area:** video
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

A separate real-NAS run already exists (`prod-spotcheck.spec.ts`, `npm run test:prod-spotcheck`). If the
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
