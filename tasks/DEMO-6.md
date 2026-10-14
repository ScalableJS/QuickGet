---
type: "task"
id: "DEMO-6"
status: "done"
priority: "p2"
area: "video"
board: "demo-video"
updated: "2026-10-09"
legacy_status: "Done"
size: "M"
---

# Scene markers → `.srt` from real ffmpeg timestamps

**Size:** M · **Area:** video
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
