---
type: "task"
id: "DEMO-7"
status: "done"
priority: "p2"
area: "video"
board: "demo-video"
updated: "2026-10-20"
size: "S"
depends_on: ["BUG-81"]
---

# Refresh store screenshots and review the promo video against the settled UI

## Outcome

The Chrome Web Store screenshots show the current popup and settings experience. The promo video
is either confirmed accurate or replaced when its setup flow or product claims no longer match.

## Problem

The four screenshots in `store-assets/screenshots/` and `store-assets/screenshots-dark/` have filesystem
modification dates of 2026-08-30. These dates are retention evidence, not a verified capture log. Since then, the popup and settings UI changed, including routing and
destination details, interception controls, connection feedback, and subsequent October polish.
Refresh and visually review them against the settled interface rather than treating the old captures as current evidence. The promo master and its
subtitle track date to 2026-08-31; their visible setup flow may also have changed, but staleness
has not been established from the asset date alone.

## Scope and sequencing

Do this after the pending settings work settles, including the settings backup, Enter-to-save, and
field-error behavior changes. Then inspect the current production build and all existing assets.
Regenerate the light and dark store screenshots with `npm run capture:store-assets` and review the
resulting images for current content, legibility, and truthful fictional data. Review the video
and subtitle against the current setup flow and claims; record a fresh take with `npm run
demo:record` only if that review finds a visible mismatch. Keep the existing capture workflows and
update `store-assets/README.md` only if their documented operation changes.

## Acceptance criteria

- [x] Light and dark screenshots show current downloads and settings UI, including the settled
      settings behavior, with no stale controls or misleading states.
- [x] The screenshots are visually reviewed at their generated 1280×800 dimensions and contain
      only fictional download data.
- [x] The promo video and English subtitle are checked against the settled setup flow and current
      product claims; either a specific no-refresh rationale is recorded or both artifacts are
      regenerated and reviewed together.
- [x] The retained files under `store-assets/` are the reviewed outputs from the capture workflow.
- [x] The extended demo includes synchronized English narration and captions, an explicitly
      optional folder-routing example, and visible evidence that the example destination is used.

## Extended demo plan: 2026-10-19

The owner requested a longer walkthrough with both English voice narration and English
subtitles. The current approximately 26-second refreshed take is an intermediate recording,
not the final approved master. Keep the four refreshed screenshots; expand the video before
closing this task.

Narration is a technical-support walkthrough: neutral, practical wording without slogans or
sales claims. Use Edge TTS `en-US-EmmaMultilingualNeural`, a female conversational English
voice verified in the live Edge voice inventory on 2026-10-19. Start at rate `-5%` and normal
pitch; adjust timing after listening rather than making the delivery artificially upbeat.
The voice inventory request succeeded, but the introductory synthesis attempt returned HTTP
403 from Edge's speech endpoint. No usable voice sample was produced; audibility and delivery
remain unverified until synthesis succeeds.

Target approximately 55–65 seconds. The extra time demonstrates an optional routing rule and
explains folder behavior; do not lengthen the video with idle holds. Show one rule in full:
names containing `.iso` route to the existing demo NAS folder `dev`. Keep the default Target
as `Download` so the routed destination is distinguishable in the final task card. A second
`program` rule adds repetition and is outside this take.

| Approximate time | Visible action and evidence | English narration and matching captions |
| --- | --- | --- |
| 0–10 s | Start on current Connection settings. Retiming of subsequent scenes follows the rendered voice duration. | This guide shows how to connect the QuickGet Chrome extension to QNAP Download Station, set download folders, and download torrents and regular files. |
| 4–17 s | Type fictional server address and credentials; Save & test; wait for Ready. | Enter your NAS address and login details, then save to check the connection. |
| 17–24 s | Show both Temp and Target folders without clipping either control. | Downloads start in the temporary folder; Download Station moves completed files to the target folder. |
| 24–39 s | Open Advanced; add one name condition `.iso` and destination `dev` through the real editor. | Folder rules are optional: send ISO images to dev automatically, while other downloads keep the default target. |
| 39–44 s | Save; verify the persisted rule, then close settings. | Save the rule, and QuickGet will use it for new matching downloads. |
| 44–52 s | Click the fixture's ordinary ISO torrent link; verify interception, request destination and toolbar badge. | Click a torrent link, and QuickGet sends the download to your NAS. |
| 52–65 s | Open the native action popup; show moving progress and the reported dev destination. | Follow progress here and see the destination chosen by your rule. |

Timing is provisional until the English narration is rendered. Use the measured audio duration
to pace each scene, retaining short reading holds on Ready, the completed rule, and the final
task card. Narration and captions must use the same reviewed text and real scene timestamps.
Deliver an H.264 1920×1080 MP4 with an English audio track, English subtitle track and matching
sidecar SRT. Review audibility, pronunciation, subtitle readability and synchronization as well
as full-resolution UI crops. Keep the native screen capture and physical cursor workflow.

The rule changes the requested destination of a new task; it does not reorganize existing NAS
files. The final downloading card proves the requested destination, not a completed NAS move.
Use a fictional `dev` folder in the mock NAS folder tree and record/assert the actual `move`
parameter and returned task destination. Do not seed the routing rule directly into storage or
draw a destination overlay. The mock provides backend responses and progress; this recording
does not establish real-appliance transfer or completion evidence.

Implementation sequence: extend the fixture and existing recording spec, validate the routing
assertions, render the English narration, record with measured scene timing, inspect the entire
master with sound, then replace the retained MP4/SRT together. Run the capture checks, mandatory
project gates and documentation checks before accepting DEMO-7. No product behavior change is
required for this scenario.

## Evidence

- `store-assets/README.md` identifies `npm run capture:store-assets` and `npm run demo:record` as
  the asset workflows.
- Filesystem modification dates: light/dark screenshots 2026-08-30; promo MP4 and subtitle
  2026-08-31.
- `git log -- src/popup src/lib/settings.ts` shows popup/settings changes
  after those retained asset dates, including 2026-09-12/13 settings and interception changes and
  2026-10-10 popup polish.
- No video refresh is asserted solely from its age; its need remains conditional on reviewing its
  visible flow and claims after the settings work.


## Acceptance: 2026-10-19

- Refreshed and visually reviewed all four 1280×800 light/dark PNGs against v2.6.3. The
  screenshot compositor now fits the complete captured viewport and sticky Save footer; the
  light fixture pins its theme rather than inheriting macOS. Capture assertions handle both
  fixture rows explicitly instead of failing a strict single-element visibility assertion.
- The old video showed the previous interface and claims. Replaced it with a 59.77-second
  1920×1080, 30 fps support walkthrough: connection/Ready, Temp and Target, optional `.iso` →
  `dev`, opt-in ordinary-file interception, torrent, unmatched ZIP, then the native action popup.
  The increased length is requested instructional content with scene-aligned narration.
- Resolved the reproduced Edge TTS 7.2.8 HTTP 403 by upgrading the local tool from the official
  PyPI index to 7.3.1. Upstream issue: https://github.com/rany2/edge-tts/issues/490.
  All eight English clips were synthesized with Emma Multilingual at rate -5% and normal pitch.
- Both extended native recording runs passed their browser/API assertions. The first take was
  rejected visually because a foreign Finder alert overlapped it. Finder was hidden without
  interacting with its file operation; the final take was visually checked across its full
  timeline and at full-resolution setup, rule and task-card frames. It has no foreign window.
- Visible captions, the English subtitle track and sidecar SRT use the same eight reviewed
  sentences. Extracted embedded cues match the sidecar and narration script exactly. Every
  voice clip fits its media-clock scene without overlap. FFmpeg decoded the complete final
  video/audio without errors; measured audio is -16.00 LUFS with -1.49 dBTP peak. Local Whisper
  transcription recovered all eight sentences, with proper-name spelling differences. This is
  technical speech/level validation, not a claim of human listening acceptance.
- Final retained artifacts are `store-assets/demo/promo-1920x1080.mp4`,
  `store-assets/demo/promo.en.srt` and the four PNGs. Only fictional credentials and mock NAS
  tasks appear; the Debian torrent is the existing official fixture. No real transfer,
  completed NAS move, or Store upload is claimed.
- Fresh checks passed: typecheck, Svelte (0 errors/warnings), lint, 594 unit/fixture tests,
  production build, 64 Chromium mock E2E, both screenshot capture tests, both extended demo
  runs, 11 documentation tests, strict documentation and English-prose checks.

## YouTube publication: 2026-10-20

Published the reviewed master as [SOMEJytR_0M](https://www.youtube.com/watch?v=SOMEJytR_0M)
on the same channel as the previous video, with public visibility and embedding enabled.
The title and description use neutral support wording; the description links to the Chrome
Web Store and explicitly identifies the mock NAS and simulated progress. YouTube checks found
no violations. Browser verification confirmed available 1080p playback, a 60-second duration,
the correct title, the Store link in the published description and a non-ASR English subtitle
track after uploading the retained eight-cue SRT. The original video remains available; the
Chrome Web Store's old promotional-video reference has not been replaced in this step.
The asset README owns the current upload and Studio management links.
