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
| DEMO-1 | Record the 28-second onboarding → intercept → progress promo | video | L | Discussion |
| DEMO-2 | Deterministic progress fixture in the mock NAS | testing | S | Backlog |
| DEMO-3 | Decide the torrent source page for the final take | video | S | Discussion |
| DEMO-4 | Demo profile + native window capture harness | video | M | Backlog |

---

## Cards

### DEMO-1 — Record the 28-second onboarding → intercept → progress promo

**Size:** L · **Area:** video · **Status:** Discussion
**Blocked by:** BUG-30 (a "Save as" dialog must never appear on camera), DEMO-2, DEMO-4

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

**Caption plan — 7 captions, ~28s** (pause names per the `demo-video` skill):

| Time | Frame | Caption | Pause |
|------|-------|---------|-------|
| 0.0–4.0 | First popup, address/login/password typed | Подключаем QuickGet к QNAP — это делается один раз | `READ.study` |
| 4.0–7.0 | Temp `Download`, Target `Multimedia/Movies` | Выбираем временную и целевую папки | `READ.study` |
| 7.0–9.5 | Save & test → "Connected to the NAS" | Сохраняем настройки и проверяем соединение | `READ.glance` |
| 9.5–13.5 | Navigate to the torrent page | Открываем обычную .torrent-ссылку | `READ.page` |
| 13.5–17.5 | Click download → hand-off runs | QuickGet перехватывает торрент и отправляет его на NAS | `READ.study` |
| 17.5–20.5 | Real toolbar icon swap + badge `1` | Иконка и бейдж показывают активную задачу | `READ.study` |
| 20.5–28.0 | Real popup via OS click → Ubuntu task progress | Прогресс загрузки виден прямо в QuickGet | `READ.study` |

Put `study` **after** a state is reached, not while text is being typed.

**Compressing onboarding honestly (target 7–9s):** cut the dead time *between* real actions
(jump cuts), never pre-seed via `chrome.storage.local.set()` while the caption claims "first
connection". Typing may be fast; the filled form gets ~0.5–0.8s to be read. `Save & test` is
already a real round-trip that renders "Connected to the NAS", so that beat needs no staging.

**Red lines for the Chrome Web Store listing:**
- Do **not** claim the torrent never touches the disk. `download-interception.spec.ts:113-122`
  accepts `"interrupted" || "complete"` — a small file can finish before the cancel. Until
  BUG-30 ships, the accurate claim is "перехватывает и отправляет в QNAP Download Station".
- No fabricated toolbar, icon, badge or popup.
- No real credentials, public IP, hostname or SID in frame (the password field is
  `type="password"`, `Settings.svelte:468`, so it is safe as-is).
- No claim of partnership with QNAP or Canonical.
- Open-source torrents only — never a private tracker or copyrighted content.
- Mock speeds are task state, not a benchmark: never caption them as throughput.

**Open questions:** the OS-level click on the real extension icon needs a fixed window
position and a pinned toolbar slot — script it against a dedicated demo profile (DEMO-4), or
do that one click by hand?

---

### DEMO-2 — Deterministic progress fixture in the mock NAS

**Size:** S · **Area:** testing · **Status:** Backlog
**Files:** `tests/e2e/support/mockNas.ts:400-412`

The payoff shot is the progress bar, and today it would be a dead 0% row. Verified: after a
real `AddTorrent` the mock creates the task with `progress: 0`, `sizeBytes: 0` and every speed
at zero. The popup then refreshes against that unchanged state.

**Fix:** an opt-in demo fixture so successive `Task/Query` calls return a rising series
(e.g. 12% → 37% → 68%, 2.1 → 4.2 → 5.0 MB/s). This is not a fake UI: the popup renders it with
production code over the same API — only the test backend is scripted, exactly as
`store-assets.spec.ts` already stages an "Ubuntu 24.04 LTS.iso" task at 68% / 5.9 GB / 4.2 MB/s.

Start the demo run with `initialTasks: []`, otherwise a pre-existing task blurs the causal
chain "clicked the link → the task appeared".

Keep it behind an explicit option so normal e2e runs stay unaffected.

---

### DEMO-3 — Decide the torrent source page for the final take

**Size:** S · **Area:** video · **Status:** Discussion

Two defensible options, and the owner has not chosen yet:

- **Real Ubuntu release / alternative-downloads page** — instantly legible as an ordinary
  website, which is most of the point. Costs reproducibility: external network, cookie banner,
  redesigns, geolocation, CDN latency, changing release names.
- **Neutral local page** served by the existing `startTorrentHost()` — fully reproducible, and
  still a *real* download: it serves a genuine `.torrent` with a real
  `content-disposition: attachment`, so `chrome.downloads.onCreated` fires for real.

Suggested split: local fixture for any repeatable/CI demo run, real page for the one-off
marketing take. **Do not** build a local look-alike of ubuntu.com — passing a fixture off as a
third-party site is worse than an honestly neutral page.

---

### DEMO-4 — Demo profile + native window capture harness

**Size:** M · **Area:** video · **Status:** Backlog
**Files:** `tests/e2e/support/extension.ts` (already accepts a persistent `userDataDir`)

Groundwork so the recording is repeatable rather than a one-off screen grab:

1. A dedicated persistent demo profile with QuickGet pinned to the toolbar and a frozen
   window size/position, so the OS-level icon click has stable coordinates.
2. Launch headed with that profile (the helper already supports `userDataDir` and `headless`).
3. Start native capture of the browser **window** — for a 1920×1080 master, the window is the
   target size, not the viewport; the toolbar eats height, so do not try to get both a
   1920×1080 viewport and the chrome in frame. Record from the Retina source and downscale.
4. Playwright waits on **facts**, never `sleep`: "Connected to the NAS", the `AddTorrent`
   request, `chrome.action.getBadgeText()`, the task appearing.
5. Encode per the skill: `-preset slow -crf 17 -tune stillimage`, `yuv420p`, `+faststart`.
6. Check the result on 1:1 crops, not a shrunken frame.

Captions: the skill's overlay assumes a Playwright-rendered page. With a native master the
`.srt` is authored against the final timeline and burned/muxed at the ffmpeg stage instead —
decide which as part of DEMO-1.
