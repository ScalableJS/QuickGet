# Chrome Web Store assets

The PNGs in this directory are generated from the real extension popup connected to the E2E mock NAS. They intentionally contain only fictional download data.

Regenerate after a UI or listing change:

```bash
npm run capture:store-assets
```

## Promo video

`demo/promo-1920x1080.mp4` is the promo demo, with `demo/promo.en.srt` alongside it. Both are
produced by a single recorded end-to-end run — the video and the pass/fail result come from the
same pass, so a broken product yields no usable master:

```bash
npm run demo:record
```

The run writes to the untracked `demo-output/`; the copies here are the reviewed ones. The
subtitles are also muxed into the mp4 as a soft `mov_text` track, but **YouTube does not read
that track** — upload `promo.en.srt` by hand when publishing.

Before upload, review each image and the text in [`../CHROMEWEBSTORE.md`](../CHROMEWEBSTORE.md). The assets are English because the first listing locale is English.
