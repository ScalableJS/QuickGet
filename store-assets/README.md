# Chrome Web Store assets

The PNGs in this directory are generated from the real extension popup connected to the E2E mock NAS. They intentionally contain only fictional download data.
Light and dark themes are pinned explicitly. Each 1280×800 composition fits the captured popup
inside its available space, including its footer.

Regenerate after a UI or listing change:

```bash
npm run capture:store-assets
```

## Promo video

Published walkthrough (2026-10-20): [QuickGet Remote: QNAP Download Station setup, folders and downloads](https://www.youtube.com/watch?v=SOMEJytR_0M).
It is public, allows embedding, has 1080p playback and a manually uploaded English SRT track.
Its description links to the Chrome Web Store listing. Manage it in
[YouTube Studio](https://studio.youtube.com/video/SOMEJytR_0M/edit).
The previous video, [ugg580zJbu8](https://www.youtube.com/watch?v=ugg580zJbu8), is retained.
The Store listing's video reference was not changed by this YouTube publication; use the new
full watch URL above when updating its promotional-video fields.

`demo/promo-1920x1080.mp4` is the support walkthrough, with `demo/promo.en.srt` alongside it. Both are
produced by a single recorded end-to-end run — the video and the pass/fail result come from the
same pass, so a broken product yields no usable master:

```bash
npm run demo:record
```

The reviewed 2026-10-19 master is 59.77 seconds, 1920×1080 at 30 fps, with eight English
caption scenes and an English AAC narration track.

The run writes to the untracked `demo-output/`; the copies here are the reviewed ones. The
English captions are visible in the picture and are also muxed as a soft `mov_text` track,
but **YouTube does not read
that track** — upload `promo.en.srt` by hand when publishing.

The extended support walkthrough shows connection setup, Temp/Target folders, an optional
`.iso` → `dev` routing rule, ordinary-file interception, and progress in the native toolbar
popup. Its backend and progress are mock responses, not evidence of a real NAS transfer.
Settings and the rule are entered through the current product UI. The capture includes the
physical macOS cursor; a previous empty-address refresh message is dismissed through the
product's standard button before recording starts.

English narration uses Edge TTS `en-US-EmmaMultilingualNeural`, rate `-5%`, normal pitch.
Install `edge-tts` 7.3.0 or newer (the 7.2.8 speech handshake returns HTTP 403; this refresh
used 7.3.1), plus `ffmpeg`, `ffprobe` and `cliclick`. No speech key is required. The script
generates and caches voice clips under `demo-output/voice/` using a hash of voice, rate and
text. Each scene lasts at least its measured spoken duration. The same reviewed text produces
the captions; media-clock marks position narration and subtitles in the final MP4. Visible
caption overlays are rendered with the existing Sharp dependency because local ffmpeg lacks
libass. Overlapping
speech fails the finishing step. The audio is normalized and encoded as an English AAC track.

Before upload, review each image and the text in [`../CHROMEWEBSTORE.md`](../CHROMEWEBSTORE.md). The assets are English because the first listing locale is English.
